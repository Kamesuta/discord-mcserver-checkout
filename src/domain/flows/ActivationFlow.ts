import {
  ActionRowBuilder,
  type ButtonBuilder,
  type ButtonInteraction,
  EmbedBuilder,
  type ModalSubmitInteraction,
} from "discord.js";
import { pterodactylCleanService } from "@/domain/services/pterodactyl/PterodactylCleanService";
import {
  type WorkflowWithUsers,
  workflowService,
} from "@/domain/services/WorkflowService";
import { workflowFields } from "@/domain/utils/workflowFields";
import { WorkflowStatus } from "@/generated/prisma/client";
import { WorkflowApproveButton } from "@/interaction-handlers/workflow/WorkflowApproveButton";
import env from "@/utils/env";
import { logger } from "@/utils/log";

type ActivationInteraction = ButtonInteraction | ModalSubmitInteraction;

/**
 * ワークフローをアクティブ化する共通処理
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
  // 1. 利用可能なサーバーを検索
  const availableServer = await workflowService.findAvailableServer();
  if (!availableServer) {
    await interaction.editReply(
      "利用可能なサーバーがありません。サーバーバインディングを確認してください。",
    );
    return null;
  }

  // 2. サーバーを再インストール（skipReset=false の場合のみ）
  if (!skipReset) {
    await pterodactylCleanService.reinstall(
      availableServer.pteroId,
      workflow.mcVersion ?? "",
    );
  }

  // 3. ステータスを ACTIVE に更新
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

  // 4. 通知チャンネルに主催者へ通知
  try {
    const channel = await interaction.client.channels.fetch(
      env.DISCORD_NOTIFY_CHANNEL_ID,
    );
    if (channel?.isSendable()) {
      const embed = new EmbedBuilder()
        .setColor(0xe74c3c)
        .setTitle(`「${availableServer.name}」貸出`)
        .setDescription(notificationMessage)
        .addFields(
          ...workflowFields({
            ...workflow,
            endDate,
            serverName: availableServer.name,
          }),
        );

      await channel.send({
        content:
          `<@${workflow.organizerDiscordId}> サーバー貸し出しが承認されました！\n` +
          `/mcserver reset-password からパスワードをリセット後、鯖管理パネルにログインできます！`,
        embeds: [embed],
      });
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
        `承認完了！サーバー \`${result.serverName}\` を割り当てました。\n期限: <t:${Math.floor(result.endDate.getTime() / 1000)}:D>`,
      );
    }
  } catch (error) {
    logger.error("承認処理中にエラーが発生しました:", error);
    const message =
      error instanceof Error ? error.message : "不明なエラーが発生しました";
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      WorkflowApproveButton.buildRetry(workflowId),
    );
    await interaction.editReply({
      content: `エラーが発生しました: ${message}`,
      components: [row],
    });
  }
}
