import type { SapphireClient } from "@sapphire/framework";
import {
  ActionRowBuilder,
  type ButtonBuilder,
  EmbedBuilder,
  type TextChannel,
} from "discord.js";
import type { ScheduledTask } from "@/domain/schedules/Scheduler";
import { serverBindingService } from "@/domain/services/ServerBindingService";
import { workflowService } from "@/domain/services/WorkflowService";
import { WorkflowStatus } from "@/generated/prisma/client";
import { ExtendButton } from "@/interaction-handlers/extend/ExtendButton";
import { ReturnConfirmButton } from "@/interaction-handlers/return/ReturnBackupSelect";
import env from "@/utils/env";
import { sapphireLogger } from "@/utils/log";

/**
 * 自動返却タスク
 * - 期限切れ（endDate が過去）の ACTIVE 貸出を検出
 * - 管理者に返却処理の開始通知を送信 → バックアップ選択フローを開始
 */
export class AutoReturnTask implements ScheduledTask {
  public readonly name = "AutoReturnTask";

  /**
   * タスクを実行する
   */
  public async execute(client: SapphireClient): Promise<void> {
    sapphireLogger.info("[AutoReturnTask] Checking for overdue workflows...");

    const activeWorkflows = await workflowService.findByStatus(
      WorkflowStatus.ACTIVE,
    );

    if (activeWorkflows.length === 0) {
      sapphireLogger.debug("[AutoReturnTask] No active workflows found");
      return;
    }

    const now = new Date();
    let notificationsSent = 0;

    for (const workflow of activeWorkflows) {
      if (!workflow.endDate) {
        continue;
      }

      // 期限切れチェック（endDateが過去）
      if (workflow.endDate < now) {
        await this._notifyAdmins(client, workflow);
        notificationsSent++;
      }
    }

    sapphireLogger.info(
      `[AutoReturnTask] Sent ${notificationsSent} overdue notifications`,
    );
  }

  /**
   * 通知チャンネルに返却処理の通知を送信する
   */
  private async _notifyAdmins(
    client: SapphireClient,
    workflow: {
      id: number;
      name: string;
      organizerDiscordId: string;
      pteroServerId: string | null;
      endDate: Date | null;
    },
  ): Promise<void> {
    try {
      const channel = await client.channels.fetch(
        env.DISCORD_NOTIFY_CHANNEL_ID,
      );
      if (!channel?.isSendable()) {
        sapphireLogger.error(
          `[AutoReturnTask] Notify channel ${env.DISCORD_NOTIFY_CHANNEL_ID} is not a sendable channel`,
        );
        return;
      }

      const endDateStr = workflow.endDate
        ? `<t:${Math.floor(workflow.endDate.getTime() / 1000)}:R>`
        : "未設定";
      const now = new Date();
      const overdueDays = workflow.endDate
        ? Math.floor(
            (now.getTime() - workflow.endDate.getTime()) /
              (1000 * 60 * 60 * 24),
          )
        : 0;

      // サーバーのバインディング名を取得
      const serverName = workflow.pteroServerId
        ? await serverBindingService.getName(workflow.pteroServerId)
        : null;

      // Embed 作成
      const embed = new EmbedBuilder()
        .setTitle(`⚠️ 自動返却通知 — ID: ${workflow.id}`)
        .setDescription(
          `<@&${env.DISCORD_ADMIN_ROLE_ID}>\n` +
            `以下のサーバー貸出が期限切れです。返却処理を実行してください。`,
        )
        .setColor(0xff9800)
        .addFields(
          { name: "主催者", value: `<@${workflow.organizerDiscordId}>` },
          { name: "申請ID", value: workflow.id.toString(), inline: true },
          { name: "企画", value: workflow.name, inline: true },
          { name: "期限", value: endDateStr, inline: true },
          {
            name: "サーバー",
            value: `\`${serverName ?? workflow.pteroServerId ?? "未割り当て"}\``,
          },
        )
        .setFooter({
          text: "返却ボタンをクリックして返却処理を開始してください",
        });

      // 延期ボタンと返却ボタン
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        ExtendButton.build(workflow.id),
        ReturnConfirmButton.build(workflow.id, false, false),
      );

      await (channel as TextChannel).send({
        content: `<@&${env.DISCORD_ADMIN_ROLE_ID}>`,
        embeds: [embed],
        components: [row],
      });

      sapphireLogger.info(
        `[AutoReturnTask] Sent overdue notification for workflow ${workflow.id} (${overdueDays} days overdue)`,
      );
    } catch (error) {
      sapphireLogger.error(
        `[AutoReturnTask] Failed to send notification for workflow ${workflow.id}:`,
        error,
      );
    }
  }
}
