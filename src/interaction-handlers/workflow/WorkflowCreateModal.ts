import { ApplyOptions } from "@sapphire/decorators";
import {
  type InteractionHandler,
  InteractionHandlerTypes,
} from "@sapphire/framework";
import type { ModalBuilder, ModalSubmitInteraction } from "discord.js";
import { notifyNewPanelUsers } from "@/domain/flows/NotifyNewPanelUsers";
import { notificationBoardService } from "@/domain/services/NotificationBoardService";
import type { BaseWorkflowParams } from "@/domain/services/WorkflowService";
import { workflowService } from "@/domain/services/WorkflowService";
import {
  type CheckoutModalDefaults,
  WorkflowBaseCheckoutModal,
} from "@/interaction-handlers/workflow/WorkflowBaseModal";
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
      `checkout-modal?${new URLSearchParams({ organizerId })}`,
      "サーバー貸出申請",
      defaults,
    );
  }

  public override parse(interaction: ModalSubmitInteraction) {
    if (!interaction.customId.startsWith("checkout-modal")) return this.none();
    return this.some();
  }

  // customId: checkout-modal?organizerId=...
  protected override async execute(
    interaction: ModalSubmitInteraction,
    fields: BaseWorkflowParams,
  ): Promise<void> {
    const [, query] = interaction.customId.split("?");
    const organizerId = new URLSearchParams(query).get("organizerId");

    if (!organizerId) {
      await interaction.editReply("エラー: 主催者IDが見つかりませんでした。");
      return;
    }

    try {
      const { workflow, newPanelUsers } = await workflowService.create({
        ...fields,
        applicantDiscordId: interaction.user.id,
        organizerDiscordId: organizerId,
      });

      await interaction.editReply({
        content: `申請を受け付けました！\n申請ID: \`${workflow.id}\`\n管理者の承認をお待ちください。`,
      });

      await notifyNewPanelUsers(
        interaction.client,
        newPanelUsers,
        interaction.guild,
      );

      // 全部確認ボードを更新
      await notificationBoardService.updateBoard(interaction.client);
    } catch (error) {
      logger.error("申請作成中にエラーが発生しました:", error);
      await interaction.editReply("申請の保存中にエラーが発生しました。");
    }
  }
}
