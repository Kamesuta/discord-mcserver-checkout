import { ApplyOptions } from "@sapphire/decorators";
import {
  type InteractionHandler,
  InteractionHandlerTypes,
} from "@sapphire/framework";
import {
  ActionRowBuilder,
  type ButtonBuilder,
  EmbedBuilder,
  type ModalBuilder,
  type ModalSubmitInteraction,
} from "discord.js";
import { customIdParams } from "@/discord-utils/customIds";
import { notificationBoardService } from "@/domain/services/NotificationBoardService";
import type { BaseWorkflowParams } from "@/domain/services/WorkflowService";
import { workflowService } from "@/domain/services/WorkflowService";
import { workflowFields } from "@/domain/utils/workflowFields";
import {
  type CheckoutModalDefaults,
  WorkflowBaseCheckoutModal,
} from "@/interaction-handlers/workflow/WorkflowBaseModal";
import { WorkflowReviewButton } from "@/interaction-handlers/workflow/WorkflowReviewButton";
import env from "@/utils/env";
import { logger } from "@/utils/log";

@ApplyOptions<InteractionHandler.Options>({
  interactionHandlerType: InteractionHandlerTypes.ModalSubmit,
})
export class WorkflowCreateModal extends WorkflowBaseCheckoutModal {
  static build(
    organizerId: string,
    defaults?: CheckoutModalDefaults,
  ): ModalBuilder {
    return WorkflowBaseCheckoutModal.buildModal(
      `checkout-modal?${new URLSearchParams({ [customIdParams.organizerId]: organizerId })}`,
      "サーバー貸出申請",
      defaults,
    );
  }

  public override parse(interaction: ModalSubmitInteraction) {
    if (!interaction.customId.startsWith("checkout-modal")) return this.none();
    return this.some();
  }

  // customId: checkout-modal?o=...
  protected override async execute(
    interaction: ModalSubmitInteraction,
    fields: BaseWorkflowParams,
  ): Promise<void> {
    const [, query] = interaction.customId.split("?");
    const organizerId = new URLSearchParams(query).get(
      customIdParams.organizerId,
    );

    if (!organizerId) {
      await interaction.editReply("エラー: 主催者IDが見つかりませんでした。");
      return;
    }

    try {
      const { workflow } = await workflowService.create({
        ...fields,
        applicantDiscordId: interaction.user.id,
        organizerDiscordId: organizerId,
      });

      await interaction.editReply({
        content: `申請を受け付けました！\n申請ID: \`${workflow.id}\`\n管理者の承認をお待ちください。`,
      });

      // 管理者に通知
      try {
        const channel = await interaction.client.channels.fetch(
          env.DISCORD_NOTIFY_CHANNEL_ID,
        );
        if (channel?.isSendable()) {
          const embed = new EmbedBuilder().setColor(0x3498db).addFields(
            ...workflowFields({
              id: workflow.id,
              name: workflow.name,
              organizerDiscordId: workflow.organizerDiscordId,
              endDate: null,
            }),
          );

          // 補足メッセージがある場合は追加
          if (workflow.description) {
            embed.addFields({
              name: "補足",
              value: workflow.description,
            });
          }

          // 確認ボタンを作成
          const reviewButton = WorkflowReviewButton.build(workflow.id);
          const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            reviewButton,
          );

          await channel.send({
            content: `<@&${env.DISCORD_ADMIN_ROLE_ID}> <@${workflow.applicantDiscordId}> から貸し出し申請がありました`,
            embeds: [embed],
            components: [row],
            allowedMentions: {
              // 管理者のみにメンションし、申請者にはメンションしない
              roles: [env.DISCORD_ADMIN_ROLE_ID],
              users: [],
            },
          });
        }
      } catch (error) {
        // 通知送信失敗は無視（ログには記録される）
        logger.error("Failed to send application notification:", error);
      }

      // 全部確認ボードを更新
      await notificationBoardService.updateBoard(interaction.client);
    } catch (error) {
      logger.error("申請作成中にエラーが発生しました:", error);
      await interaction.editReply("申請の保存中にエラーが発生しました。");
    }
  }
}
