import type { SapphireClient } from "@sapphire/framework";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type TextChannel,
} from "discord.js";
import { workflowService } from "../../domain/services/WorkflowService.js";
import { WorkflowStatus } from "../../generated/prisma/client.js";
import env from "../../utils/env.js";
import { sapphireLogger } from "../../utils/log.js";
import type { ScheduledTask } from "../Scheduler.js";

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
        await this.notifyAdmins(client, workflow);
        notificationsSent++;
      }
    }

    sapphireLogger.info(
      `[AutoReturnTask] Sent ${notificationsSent} overdue notifications`,
    );
  }

  /**
   * 管理者チャンネルに返却処理の通知を送信する
   */
  private async notifyAdmins(
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
      const channel = await client.channels.fetch(env.DISCORD_ADMIN_CHANNEL_ID);
      if (!channel?.isTextBased()) {
        sapphireLogger.error(
          `[AutoReturnTask] Admin channel ${env.DISCORD_ADMIN_CHANNEL_ID} is not a text channel`,
        );
        return;
      }

      const endDateStr =
        workflow.endDate?.toLocaleDateString("ja-JP") ?? "未設定";
      const now = new Date();
      const overdueDays = workflow.endDate
        ? Math.floor(
            (now.getTime() - workflow.endDate.getTime()) /
              (1000 * 60 * 60 * 24),
          )
        : 0;

      // Embed 作成
      const embed = new EmbedBuilder()
        .setTitle(`⚠️ 自動返却通知 — ID: ${workflow.id}`)
        .setDescription(
          `以下のサーバー貸出が期限切れです。返却処理を実行してください。`,
        )
        .setColor(0xff9800)
        .addFields(
          { name: "企画名", value: workflow.name },
          { name: "主催者", value: `<@${workflow.organizerDiscordId}>` },
          { name: "サーバーID", value: `\`${workflow.pteroServerId}\`` },
          { name: "期限", value: endDateStr },
          { name: "期限超過", value: `${overdueDays} 日経過` },
        )
        .setFooter({
          text: "返却ボタンをクリックして返却処理を開始してください",
        });

      // 返却ボタン
      const params = new URLSearchParams({ workflowId: String(workflow.id) });
      const button = new ButtonBuilder()
        .setCustomId(`return-confirm?${params.toString()}`)
        .setLabel("返却を実行")
        .setStyle(ButtonStyle.Danger);

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button);

      await (channel as TextChannel).send({
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
