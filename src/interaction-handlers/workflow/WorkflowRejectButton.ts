import { ApplyOptions } from "@sapphire/decorators";
import {
  InteractionHandler,
  InteractionHandlerTypes,
} from "@sapphire/framework";
import {
  ActionRowBuilder,
  ButtonBuilder,
  type ButtonInteraction,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
} from "discord.js";
import { notificationBoardService } from "@/domain/services/NotificationBoardService";
import { workflowService } from "@/domain/services/WorkflowService";
import { workflowFields } from "@/domain/utils/workflowFields";
import { WorkflowStatus } from "@/generated/prisma/client";
import env from "@/utils/env";
import { logger } from "@/utils/log";

@ApplyOptions<InteractionHandler.Options>({
  interactionHandlerType: InteractionHandlerTypes.Button,
})
export class WorkflowRejectButton extends InteractionHandler {
  static build(workflowId: number): ButtonBuilder {
    return new ButtonBuilder()
      .setCustomId(
        `reject-button?${new URLSearchParams({ workflowId: String(workflowId) })}`,
      )
      .setLabel("却下")
      .setStyle(ButtonStyle.Danger);
  }

  static buildRetry(workflowId: number): ButtonBuilder {
    return new ButtonBuilder()
      .setCustomId(
        `reject-button?${new URLSearchParams({ workflowId: String(workflowId) })}`,
      )
      .setLabel("再試行")
      .setStyle(ButtonStyle.Primary);
  }

  public override parse(interaction: ButtonInteraction) {
    if (!interaction.customId.startsWith("reject-button")) return this.none();
    return this.some();
  }

  public override async run(interaction: ButtonInteraction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const [, query] = interaction.customId.split("?");
    const workflowId = Number(new URLSearchParams(query).get("workflowId"));

    try {
      const workflow = await workflowService.findById(workflowId);
      if (!workflow) {
        await interaction.editReply("申請が見つかりませんでした。");
        return;
      }

      if (workflow.status !== WorkflowStatus.PENDING) {
        await interaction.editReply("この申請は既に処理されています。");
        return;
      }

      // ステータスを REJECTED に更新
      await workflowService.updateStatus({
        id: workflowId,
        status: WorkflowStatus.REJECTED,
      });

      // 通知チャンネルに却下通知を送信
      try {
        const channel = await interaction.client.channels.fetch(
          env.DISCORD_NOTIFY_CHANNEL_ID,
        );
        if (channel?.isSendable()) {
          const embed = new EmbedBuilder()
            .setColor(0x95a5a6)
            .setTitle("サーバー貸出申請が却下されました")
            .setDescription("申請が却下されました。")
            .addFields(...workflowFields(workflow));

          await channel.send({
            content: `<@${workflow.organizerDiscordId}> サーバー貸出申請が却下されました。`,
            embeds: [embed],
          });
        }
      } catch (error) {
        logger.error("Failed to send rejection notification:", error);
      }

      // 通知ボードを更新
      await notificationBoardService.updateBoard(interaction.client);

      await interaction.editReply(
        `申請 #${workflowId} を却下しました。申請者に通知を送信しました。`,
      );
    } catch (error) {
      logger.error("却下処理中にエラーが発生しました:", error);
      const message =
        error instanceof Error ? error.message : "不明なエラーが発生しました";
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        WorkflowRejectButton.buildRetry(workflowId),
      );
      await interaction.editReply({
        content: `エラーが発生しました: ${message}`,
        components: [row],
      });
    }
  }
}
