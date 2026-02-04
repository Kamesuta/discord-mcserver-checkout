import {
  type ButtonInteraction,
  EmbedBuilder,
  type TextChannel,
} from "discord.js";
import { ArchiveName } from "@/domain/services/ArchiveName";
import { archiveService } from "@/domain/services/ArchiveService";
import { pterodactylCleanService } from "@/domain/services/pterodactyl/PterodactylCleanService";
import { serverBindingService } from "@/domain/services/ServerBindingService";
import { workflowService } from "@/domain/services/WorkflowService";
import { WorkflowStatus } from "@/generated/prisma/client";
import env from "@/utils/env";

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
  const guild = interaction.guild;

  // サーバーのバインディング名を取得
  const serverName = await serverBindingService.getName(serverId);

  // フォルダ名を構築: [ID]_YYYYMMdd_企画名_[Name]主催
  let organizerName = workflow.organizerDiscordId;
  if (guild) {
    try {
      const organizer = await guild.members.fetch(workflow.organizerDiscordId);
      organizerName = organizer.displayName;
    } catch {
      // ユーザー情報取得失敗時は Discord ID を使用
    }
  }

  const eventDate = workflow.eventDate ?? new Date();
  const archiveName = new ArchiveName({
    workflowId: workflow.id,
    workflowName: workflow.name,
    organizerName,
    eventDate,
    mcVersion: workflow.mcVersion ?? undefined,
  });

  // 1. バックアップアーカイブ（skipArchive=false の場合のみ）
  if (!skipArchive) {
    await archiveService.archiveBackup(serverId, archiveName, "★");
  }

  // 2. サーバーリセット（全ファイル削除・reinstallなし）（skipReset=false の場合のみ）
  if (!skipReset) {
    await pterodactylCleanService.reset(serverId);
  }

  // 3. ステータスを RETURNED に更新
  await workflowService.updateStatus({
    id: workflow.id,
    status: WorkflowStatus.RETURNED,
  });

  // 4. 通知チャンネルに主催者へ返却通知
  try {
    const channel = await interaction.client.channels.fetch(
      env.DISCORD_NOTIFY_CHANNEL_ID,
    );
    if (channel?.isSendable()) {
      const embed = new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle(`「${serverName}」返却`)
        .addFields(
          { name: "企画", value: workflow.name },
          { name: "申請ID", value: workflow.id.toString(), inline: true },
          {
            name: "主催者",
            value: `<@${workflow.organizerDiscordId}>`,
            inline: true,
          },
        );
      await channel.send({
        content: `${interaction.user}によってサーバー貸出が返却されました。`,
        embeds: [embed],
      });
    }
  } catch (error) {
    // 通知送信失敗は無視（ログには記録される）
    console.error("Failed to send return notification:", error);
  }

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
