import type { SapphireClient } from "@sapphire/framework";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type TextChannel,
} from "discord.js";
import { serverBindingService } from "../../domain/services/ServerBindingService.js";
import { workflowService } from "../../domain/services/WorkflowService.js";
import { WorkflowStatus } from "../../generated/prisma/client.js";
import env from "../../utils/env.js";
import { sapphireLogger } from "../../utils/log.js";
import type { ScheduledTask } from "../Scheduler.js";

/**
 * 期限切れ予定のリマインド通知タスク
 * - 期限 3 日前・1 日前の ACTIVE 貸出を検出
 * - 主催者に期限切れ予定の通知を送信
 */
export class ReminderTask implements ScheduledTask {
  public readonly name = "ReminderTask";

  /**
   * タスクを実行する
   */
  public async execute(client: SapphireClient): Promise<void> {
    sapphireLogger.info("[ReminderTask] Checking for upcoming deadlines...");

    const activeWorkflows = await workflowService.findByStatus(
      WorkflowStatus.ACTIVE,
    );

    if (activeWorkflows.length === 0) {
      sapphireLogger.debug("[ReminderTask] No active workflows found");
      return;
    }

    const now = new Date();
    let reminderseSent = 0;

    for (const workflow of activeWorkflows) {
      if (!workflow.endDate) {
        continue;
      }

      // 期限までの残り日数を計算
      const daysUntilDeadline = this._calculateDaysUntil(now, workflow.endDate);

      // 3日前または1日前の場合に通知
      if (daysUntilDeadline === 3 || daysUntilDeadline === 1) {
        await this._sendReminder(
          client,
          workflow.organizerDiscordId,
          workflow,
          daysUntilDeadline,
        );
        reminderseSent++;
      } else if (daysUntilDeadline < 0) {
        sapphireLogger.warn(
          `[ReminderTask] Workflow ${workflow.id} is overdue by ${Math.abs(daysUntilDeadline)} days`,
        );
      }
    }

    sapphireLogger.info(`[ReminderTask] Sent ${reminderseSent} reminders`);
  }

  /**
   * 指定日までの残り日数を計算する
   */
  private _calculateDaysUntil(from: Date, to: Date): number {
    // 時刻を無視して日付のみで比較
    const fromDate = new Date(
      from.getFullYear(),
      from.getMonth(),
      from.getDate(),
    );
    const toDate = new Date(to.getFullYear(), to.getMonth(), to.getDate());

    const diffMs = toDate.getTime() - fromDate.getTime();
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  }

  /**
   * 通知チャンネルに主催者へのリマインド通知を送信する
   */
  private async _sendReminder(
    client: SapphireClient,
    organizerDiscordId: string,
    workflow: {
      id: number;
      name: string;
      pteroServerId: string | null;
      endDate: Date | null;
    },
    daysRemaining: number,
  ): Promise<void> {
    try {
      const channel = await client.channels.fetch(
        env.DISCORD_NOTIFY_CHANNEL_ID,
      );
      if (!channel?.isTextBased()) {
        sapphireLogger.error(
          `[ReminderTask] Notify channel ${env.DISCORD_NOTIFY_CHANNEL_ID} is not a text channel`,
        );
        return;
      }

      const endDateStr =
        workflow.endDate?.toLocaleDateString("ja-JP") ?? "未設定";

      // サーバーのバインディング名を取得
      const serverName = workflow.pteroServerId
        ? await serverBindingService.getName(workflow.pteroServerId)
        : null;

      // 延期ボタン
      const params = new URLSearchParams({ workflowId: String(workflow.id) });
      const extendButton = new ButtonBuilder()
        .setCustomId(`extend-workflow?${params.toString()}`)
        .setLabel("1週間延長")
        .setStyle(ButtonStyle.Primary);

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        extendButton,
      );

      await (channel as TextChannel).send({
        content:
          `<@${organizerDiscordId}> <@&${env.DISCORD_ADMIN_ROLE_ID}>\n` +
          `**【リマインド】サーバー貸出期限のお知らせ**\n\n` +
          `企画: ${workflow.name}\n` +
          `申請ID: ${workflow.id}\n` +
          `サーバー: \`${serverName ?? workflow.pteroServerId ?? "未割り当て"}\`\n` +
          `期限: ${endDateStr}\n` +
          `**残り ${daysRemaining} 日**\n\n` +
          `期限が近づいています。延長が必要な場合は下のボタンを押してください。`,
        components: [row],
      });

      sapphireLogger.info(
        `[ReminderTask] Sent reminder for workflow ${workflow.id} (${daysRemaining} days remaining)`,
      );
    } catch (error) {
      sapphireLogger.error(
        `[ReminderTask] Failed to send reminder for workflow ${workflow.id}:`,
        error,
      );
    }
  }
}
