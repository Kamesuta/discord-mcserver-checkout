import { ApplyOptions } from "@sapphire/decorators";
import {
  type InteractionHandler,
  InteractionHandlerTypes,
} from "@sapphire/framework";
import type { ModalSubmitInteraction } from "discord.js";
import type { BaseWorkflowParams } from "../../domain/services/WorkflowService.js";
import { workflowService } from "../../domain/services/WorkflowService.js";
import { logger } from "../../utils/log.js";
import { BaseCheckoutModalHandler } from "./WorkflowBaseModal.js";

@ApplyOptions<InteractionHandler.Options>({
  interactionHandlerType: InteractionHandlerTypes.ModalSubmit,
})
export class WorkflowCreateModal extends BaseCheckoutModalHandler {
  public override parse(interaction: ModalSubmitInteraction) {
    if (!interaction.customId.startsWith("checkout_modal")) return this.none();
    return this.some();
  }

  // customId: checkout_modal?organizerId=...
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
      const workflow = await workflowService.create({
        ...fields,
        applicantDiscordId: interaction.user.id,
        organizerDiscordId: organizerId,
      });

      await interaction.editReply({
        content: `申請を受け付けました！\n申請ID: \`${workflow.id}\`\n管理者の承認をお待ちください。`,
      });
    } catch (error) {
      logger.error("申請作成中にエラーが発生しました:", error);
      await interaction.editReply("申請の保存中にエラーが発生しました。");
    }
  }
}
