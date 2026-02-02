import type { SapphireClient } from "@sapphire/framework";
import { workflowService } from "../../domain/services/WorkflowService.js";
import { WorkflowStatus } from "../../generated/prisma/client.js";
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
      const daysUntilDeadline = this.calculateDaysUntil(now, workflow.endDate);

      // 3日前または1日前の場合に通知
      if (daysUntilDeadline === 3 || daysUntilDeadline === 1) {
        await this.sendReminder(
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
  private calculateDaysUntil(from: Date, to: Date): number {
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
   * 主催者にリマインド通知を送信する
   */
  private async sendReminder(
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
      const user = await client.users.fetch(organizerDiscordId);
      const endDateStr =
        workflow.endDate?.toLocaleDateString("ja-JP") ?? "未設定";

      await user.send(
        `**【リマインド】サーバー貸出期限のお知らせ**\n\n` +
          `企画: ${workflow.name}\n` +
          `申請ID: ${workflow.id}\n` +
          `サーバーID: \`${workflow.pteroServerId}\`\n` +
          `期限: ${endDateStr}\n` +
          `**残り ${daysRemaining} 日**\n\n` +
          `期限が近づいています。延長が必要な場合は管理者にお問い合わせください。`,
      );

      sapphireLogger.info(
        `[ReminderTask] Sent reminder to ${organizerDiscordId} for workflow ${workflow.id} (${daysRemaining} days remaining)`,
      );
    } catch (error) {
      sapphireLogger.error(
        `[ReminderTask] Failed to send reminder to ${organizerDiscordId}:`,
        error,
      );
    }
  }
}
