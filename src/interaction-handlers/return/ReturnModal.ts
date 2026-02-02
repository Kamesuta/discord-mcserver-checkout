import { ApplyOptions } from "@sapphire/decorators";
import {
  InteractionHandler,
  InteractionHandlerTypes,
} from "@sapphire/framework";
import type { ModalSubmitInteraction } from "discord.js";
import { completeReturn } from "@/domain/flows/ReturnFlow.js";
import { logger } from "@/utils/log.js";

@ApplyOptions<InteractionHandler.Options>({
  interactionHandlerType: InteractionHandlerTypes.ModalSubmit,
})
export class ReturnModal extends InteractionHandler {
  public override parse(interaction: ModalSubmitInteraction) {
    if (!interaction.customId.startsWith("return-modal")) return this.none();
    return this.some();
  }

  public override async run(interaction: ModalSubmitInteraction) {
    await interaction.deferReply();

    const [, query] = interaction.customId.split("?");
    const params = new URLSearchParams(query);
    const workflowId = Number(params.get("workflowId"));

    const returnDate = interaction.fields.getTextInputValue("date");
    const comment =
      interaction.fields.getTextInputValue("comment") || undefined;

    try {
      await completeReturn(interaction, workflowId, returnDate, comment);
    } catch (error) {
      logger.error("返却処理中にエラーが発生しました:", error);
      const message =
        error instanceof Error ? error.message : "不明なエラーが発生しました";
      await interaction.editReply(`エラーが発生しました: ${message}`);
    }
  }
}
