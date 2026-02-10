import {
  ActionRowBuilder,
  type ButtonBuilder,
  type ButtonInteraction,
  EmbedBuilder,
} from "discord.js";
import { ProgressTracker } from "@/discord-utils/ProgressTracker";
import { ArchiveName } from "@/domain/services/ArchiveName";
import { archiveService } from "@/domain/services/ArchiveService";
import { notificationBoardService } from "@/domain/services/NotificationBoardService";
import { pterodactylBackupService } from "@/domain/services/pterodactyl/PterodactylBackupService";
import { pterodactylCleanService } from "@/domain/services/pterodactyl/PterodactylCleanService";
import { pterodactylStartupService } from "@/domain/services/pterodactyl/PterodactylStartupService";
import { serverBindingService } from "@/domain/services/ServerBindingService";
import { userService } from "@/domain/services/UserService";
import { workflowService } from "@/domain/services/WorkflowService";
import type { Workflow } from "@/generated/prisma/client";
import { WorkflowStatus } from "@/generated/prisma/client";
import { ReturnConfirmButton } from "@/interaction-handlers/return/ReturnBackupSelect";
import env from "@/utils/env";
import { pterodactylService } from "../services/pterodactyl/PterodactylService.js";
import { workflowFields } from "../utils/workflowFields.js";

/**
 * 返却処理の本体：アーカイブ・サーバーリセット・通知
 * @param interaction ボタンのインタラクション（deferReply済み）
 * @param workflowId ワークフロー ID
 * @param skipReset サーバーリセット（全ファイル削除）をスキップする場合は true
 * @param skipArchive アーカイブ処理をスキップする場合は true
 */
export async function completeReturn(
  interaction: ButtonInteraction,
  workflowId: number,
  skipReset: boolean = false,
  skipArchive: boolean = false,
): Promise<void> {
  const workflow = await workflowService.findById(workflowId);
  if (!workflow || !workflow.pteroServerId) {
    await interaction.editReply("申請が見つかりませんでした。");
    return;
  }

  if (workflow.status !== WorkflowStatus.ACTIVE) {
    await interaction.editReply("この申請は ACTIVE ではありません。");
    return;
  }

  const serverId = workflow.pteroServerId;

  // サーバーのバインディング名を取得
  const serverName = await serverBindingService.getName(serverId);

  // フォルダ名を構築: [ID]_YYYYMMdd_企画名_[Name]主催
  const organizerUser = await userService.findByDiscordId(
    workflow.organizerDiscordId,
  );
  const organizerName = organizerUser?.nickname ?? workflow.organizerDiscordId;

  // Minecraft バージョンを優先順位に従って取得
  // 1. version_history.json 2. Pterodactylの起動変数 3. DBのmcVersion 4. undefined
  const mcVersion = await pterodactylStartupService.getMinecraftVersion(
    serverId,
    workflow.mcVersion ?? undefined,
  );

  const eventDate = workflow.eventDate ?? new Date();
  const archiveName = new ArchiveName({
    workflowId: workflow.id,
    workflowName: workflow.name,
    organizerName,
    eventDate,
    mcVersion,
  });

  // 実行するステップを決定
  type ReturnStep = "stop" | "archive" | "reset";
  const steps: ReturnStep[] = [];
  if (!skipReset) steps.push("stop");
  if (!skipArchive) steps.push("archive");
  if (!skipReset) steps.push("reset");

  // 進捗トラッカーを初期化
  const progress = new ProgressTracker<ReturnStep>(
    interaction,
    "返却処理中",
    {
      stop: "サーバーを停止",
      archive: "バックアップアーカイブ",
      reset: "サーバーリセット",
    },
    steps,
  );

  // サーバーを停止
  if (!skipReset) {
    await progress.execute("stop", async () => {
      const stopResult = await pterodactylService.setPowerState(
        serverId,
        "stop",
      );
      await stopResult.wait();
    });
  }

  // バックアップアーカイブ（skipArchive=false の場合のみ）
  if (!skipArchive) {
    await progress.execute("archive", async () => {
      await archiveService.archiveBackup(serverId, archiveName, "★");
    });
  }

  // サーバーリセット（全ファイル削除・reinstallなし）（skipReset=false の場合のみ）
  if (!skipReset) {
    await progress.execute("reset", async () => {
      await pterodactylCleanService.reset(serverId);
    });

    // リセット時はDescriptionを「空」にする
    try {
      await pterodactylService.updateServerDescription(serverId, "空");
    } catch (error) {
      // Description更新失敗は無視（ログには記録される）
      console.error("Failed to update server description:", error);
    }
  }

  // ステータスを RETURNED に更新
  await workflowService.updateStatus({
    id: workflow.id,
    status: WorkflowStatus.RETURNED,
  });

  // 通知チャンネルに主催者へ返却通知
  try {
    const channel = await interaction.client.channels.fetch(
      env.DISCORD_NOTIFY_CHANNEL_ID,
    );
    if (channel?.isSendable()) {
      const embed = new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle(`「${serverName}」返却`)
        .addFields(...workflowFields({ ...workflow, serverName }));
      await channel.send({
        content: `${interaction.user}によってサーバー貸出が返却されました。`,
        embeds: [embed],
      });
    }
  } catch (error) {
    // 通知送信失敗は無視（ログには記録される）
    console.error("Failed to send return notification:", error);
  }

  // 全部確認ボードを更新
  await notificationBoardService.updateBoard(interaction.client);

  const statusParts = [
    !skipArchive && "アーカイブ済み",
    !skipReset && "リセット済み",
  ].filter(Boolean);

  await interaction.editReply(
    `返却完了！サーバー \`${serverName ?? serverId}\`\n` +
      (statusParts.length > 0
        ? statusParts.join("・")
        : "アーカイブ・リセットはスキップされました"),
  );
}

/**
 * バイトサイズを人間が読みやすい形式に変換する
 */
function _formatSize(bytes: number): string {
  const kb = bytes / 1024;
  if (kb >= 1024) {
    return `${(kb / 1024).toFixed(1)} MB`;
  }
  return `${Math.ceil(kb)} KB`;
}

/**
 * 返却確認Embedとボタンを作成する
 * @param workflow ワークフロー（ACTIVE状態、pteroServerId必須）
 * @param skipReset サーバーリセットをスキップするか
 * @param skipArchive アーカイブ処理をスキップするか
 * @returns Embedとボタンのアクションロウ
 */
export async function createReturnConfirmation(
  workflow: Workflow & { panelUsers: { discordId: string }[] },
  skipReset: boolean,
  skipArchive: boolean,
): Promise<{ embed: EmbedBuilder; row: ActionRowBuilder<ButtonBuilder> }> {
  if (!workflow.pteroServerId) {
    throw new Error("pteroServerId が設定されていません");
  }

  // ロック済みバックアップ一覧取得（情報表示用）
  const backups = await pterodactylBackupService.listBackups(
    workflow.pteroServerId,
  );
  const locked = backups.filter((b) => b.attributes.is_locked);

  // サーバーのバインディング名を取得
  const serverName = await serverBindingService.getName(workflow.pteroServerId);

  // Embed 作成
  const embed = new EmbedBuilder()
    .setColor(0xe74c3c)
    .setTitle(`「${serverName}」返却`)
    .addFields(...workflowFields({ ...workflow, serverName }));

  // スキップ警告を追加
  if (skipArchive && !skipReset) {
    embed.addFields({
      name: "⚠️データ消失注意",
      value: "バックアップを取らず**初期化されます**！\n十分注意してください！",
    });
  }
  if (skipArchive || skipReset) {
    const warnMessages: string[] = [];
    if (skipArchive) {
      warnMessages.push("- バックアップtar.gzは作成されません");
    }
    if (skipReset) {
      warnMessages.push("- 初期化はされません");
    }
    embed.addFields({
      name: "スキップ",
      value: warnMessages.join("\n"),
    });
  }

  // ロック済みバックアップ一覧（アーカイブ対象）
  if (locked.length > 0) {
    embed.addFields({
      name: "追加アーカイブ対象（ロック済みバックアップ）",
      value: locked
        .map(
          (b) => `🔒 ${b.attributes.name} (${_formatSize(b.attributes.bytes)})`,
        )
        .join("\n"),
    });
  }

  // 確認ボタン
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    ReturnConfirmButton.build(workflow.id, skipReset, skipArchive),
  );

  return { embed, row };
}
