import { ApplyOptions } from "@sapphire/decorators";
import {
  InteractionHandler,
  InteractionHandlerTypes,
} from "@sapphire/framework";
import type { ButtonInteraction } from "discord.js";
import { completeReturn } from "@/domain/flows/ReturnFlow";
import { logger } from "@/utils/log";

@ApplyOptions<InteractionHandler.Options>({
  interactionHandlerType: InteractionHandlerTypes.Button,
})
export class ReturnConfirmButton extends InteractionHandler {
  public override parse(interaction: ButtonInteraction) {
    if (!interaction.customId.startsWith("return-confirm")) return this.none();
    return this.some();
  }

  public override async run(interaction: ButtonInteraction) {
    const [, query] = interaction.customId.split("?");
    const params = new URLSearchParams(query);
    const workflowId = Number(params.get("workflowId"));

    await interaction.deferReply();

    try {
      await completeReturn(interaction, workflowId);
    } catch (error) {
      logger.error("返却処理中にエラーが発生しました:", error);
      const message =
        error instanceof Error ? error.message : "不明なエラーが発生しました";
      await interaction.editReply(`エラーが発生しました: ${message}`);
    }
  }
}
