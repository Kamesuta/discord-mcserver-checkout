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
import env from "@/utils/env";
import { sapphireLogger } from "@/utils/log";

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
      if (!channel?.isSendable()) {
        sapphireLogger.error(
          `[ReminderTask] Notify channel ${env.DISCORD_NOTIFY_CHANNEL_ID} is not a text channel`,
        );
        return;
      }

      const endDateStr = workflow.endDate
        ? `<t:${Math.floor(workflow.endDate.getTime() / 1000)}:R>`
        : "未設定";

      // サーバーのバインディング名を取得
      const serverName = workflow.pteroServerId
        ? await serverBindingService.getName(workflow.pteroServerId)
        : null;

      // 延期ボタン
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        ExtendButton.build(workflow.id),
      );

      const embed = new EmbedBuilder()
        .setColor(0xff9800)
        .setTitle(`「${serverName}」貸出期限のお知らせ`)
        .addFields(
          { name: "主催者", value: `<@${organizerDiscordId}>` },
          { name: "申請ID", value: workflow.id.toString(), inline: true },
          { name: "企画", value: workflow.name, inline: true },
          { name: "期限", value: endDateStr, inline: true },
        )
        .setFooter({
          text: "延長ボタンを押して延長処理を開始してください",
        });

      await channel.send({
        content: `<@${organizerDiscordId}>【リマインド】サーバー貸出期限のお知らせ`,
        embeds: [embed],
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
