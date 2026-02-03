import type {
  ButtonInteraction,
  ModalSubmitInteraction,
  TextChannel,
} from "discord.js";
import { pterodactylCleanService } from "@/domain/services/pterodactyl/PterodactylCleanService";
import { pterodactylUserService } from "@/domain/services/pterodactyl/PterodactylUserService";
import {
  type WorkflowWithUsers,
  workflowService,
} from "@/domain/services/WorkflowService";
import { WorkflowStatus } from "@/generated/prisma/client";
import env from "@/utils/env";
import { logger } from "@/utils/log";
import { prisma } from "@/utils/prisma";

type ActivationInteraction = ButtonInteraction | ModalSubmitInteraction;

/**
 * ワークフローをアクティブ化する共通処理
 * - パネルユーザーにロール付与
 * - サーバー割り当て
 * - パネルユーザー追加
 * - サーバーリセット（オプション）
 * - 通知
 * @param interaction インタラクション（deferReply済み）
 * @param workflow ワークフロー（PENDING または作成直後）
 * @param skipReset サーバーをリセットしない場合は true
 * @param notificationMessage 通知メッセージのタイトル（デフォルト: "サーバー貸出が承認されました！"）
 * @returns 割り当てられたサーバー名と終了日、またはエラー時は null
 */
export async function activateWorkflow(
  interaction: ActivationInteraction,
  workflow: WorkflowWithUsers,
  skipReset: boolean = false,
  notificationMessage: string = "サーバー貸出が承認されました！",
): Promise<{ serverName: string; endDate: Date } | null> {
  const guild = interaction.guild;
  if (!guild) {
    await interaction.editReply("Guild情報が取得できませんでした。");
    return null;
  }

  // 1. パネルユーザーに Discord ロール付与（未付与の場合のみ）
  for (const panelUser of workflow.panelUsers) {
    const member = await guild.members.fetch(panelUser.discordId);
    if (!member.roles.cache.has(env.DISCORD_PANEL_USER_ROLE_ID)) {
      await member.roles.add(env.DISCORD_PANEL_USER_ROLE_ID);
    }
  }

  // 2. 利用可能なサーバーを検索
  const availableServer = await workflowService.findAvailableServer();
  if (!availableServer) {
    await interaction.editReply(
      "利用可能なサーバーがありません。サーバーバインディングを確認してください。",
    );
    return null;
  }

  // 3. パネルにユーザー追加・権限付与
  const pteroUsers = await prisma.pterodactylUser.findMany({
    where: {
      discordId: { in: workflow.panelUsers.map((u) => u.discordId) },
    },
  });

  for (const pteroUser of pteroUsers) {
    await pterodactylUserService.addUser(
      availableServer.pteroId,
      pteroUser.email,
    );
  }

  // 4. サーバーをクリーン（skipReset=false の場合のみ）
  if (!skipReset) {
    await pterodactylCleanService.clean(
      availableServer.pteroId,
      workflow.mcVersion ?? "",
    );
  }

  // 5. ステータスを ACTIVE に更新
  const now = new Date();
  const endDate = new Date(
    now.getTime() + workflow.periodDays * 24 * 60 * 60 * 1000,
  );
  await workflowService.updateStatus({
    id: workflow.id,
    status: WorkflowStatus.ACTIVE,
    pteroServerId: availableServer.pteroId,
    startDate: now,
    endDate,
  });

  // 6. 通知チャンネルに主催者へ通知
  try {
    const channel = await interaction.client.channels.fetch(
      env.DISCORD_NOTIFY_CHANNEL_ID,
    );
    if (channel?.isTextBased()) {
      await (channel as TextChannel).send(
        `<@${workflow.organizerDiscordId}>\n` +
          `**${notificationMessage}**\n\n` +
          `申請ID: ${workflow.id}\n` +
          `企画: ${workflow.name}\n` +
          `サーバー: \`${availableServer.name}\`\n` +
          `期限: ${endDate.toLocaleDateString("ja-JP")}` +
          (skipReset ? "\n⚠️ サーバーはリセットされていません" : ""),
      );
    }
  } catch (error) {
    // 通知送信失敗は無視（ログには記録される）
    logger.error("Failed to send activation notification:", error);
  }

  return { serverName: availableServer.name, endDate };
}

/**
 * 承認処理の本体：PENDING ワークフローを ACTIVE に遷移
 * @param interaction ボタン or モーダルのインタラクション（deferReply済み）
 * @param workflowId ワークフロー ID
 */
export async function completeApproval(
  interaction: ActivationInteraction,
  workflowId: number,
): Promise<void> {
  const workflow = await workflowService.findById(workflowId);
  if (!workflow) {
    await interaction.editReply("申請が見つかりませんでした。");
    return;
  }

  if (workflow.status !== WorkflowStatus.PENDING) {
    await interaction.editReply("この申請は既に処理されています。");
    return;
  }

  try {
    const result = await activateWorkflow(
      interaction,
      workflow,
      false,
      "サーバー貸出が承認されました！",
    );

    if (result) {
      await interaction.editReply(
        `承認完了！サーバー \`${result.serverName}\` を割り当てました。\n期限: ${result.endDate.toLocaleDateString("ja-JP")}`,
      );
    }
  } catch (error) {
    logger.error("承認処理中にエラーが発生しました:", error);
    const message =
      error instanceof Error ? error.message : "不明なエラーが発生しました";
    await interaction.editReply(`エラーが発生しました: ${message}`);
  }
}
