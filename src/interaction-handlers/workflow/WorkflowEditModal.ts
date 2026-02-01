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
export class EditModalHandler extends BaseCheckoutModalHandler {
  public override parse(interaction: ModalSubmitInteraction) {
    if (!interaction.customId.startsWith("edit_modal")) return this.none();
    return this.some();
  }

  // customId: edit_modal?workflowId=...
  protected override async execute(
    interaction: ModalSubmitInteraction,
    fields: BaseWorkflowParams,
  ): Promise<void> {
    const [, query] = interaction.customId.split("?");
    const workflowId = Number(new URLSearchParams(query).get("workflowId"));

    if (Number.isNaN(workflowId)) {
      await interaction.editReply("エラー: 申請IDが見つかりませんでした。");
      return;
    }

    try {
      await workflowService.update({
        id: workflowId,
        ...fields,
      });

      await interaction.editReply(
        `申請 (ID: \`${workflowId}\`) を編集しました。`,
      );
    } catch (error) {
      logger.error("申請編集中にエラーが発生しました:", error);
      await interaction.editReply("申請の編集中にエラーが発生しました。");
    }
  }
}
