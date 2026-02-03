import { ApplyOptions } from "@sapphire/decorators";
import {
  InteractionHandler,
  InteractionHandlerTypes,
} from "@sapphire/framework";
import type { ButtonInteraction } from "discord.js";
import { completeApproval } from "@/domain/flows/ApprovalFlow";
import { logger } from "@/utils/log";

@ApplyOptions<InteractionHandler.Options>({
  interactionHandlerType: InteractionHandlerTypes.Button,
})
export class WorkflowApproveButton extends InteractionHandler {
  public override parse(interaction: ButtonInteraction) {
    if (!interaction.customId.startsWith("approve-button")) return this.none();
    return this.some();
  }

  public override async run(interaction: ButtonInteraction) {
    await interaction.deferReply();

    const [, query] = interaction.customId.split("?");
    const workflowId = Number(new URLSearchParams(query).get("workflowId"));

    try {
      await completeApproval(interaction, workflowId);
    } catch (error) {
      logger.error("承認処理中にエラーが発生しました:", error);
      const message =
        error instanceof Error ? error.message : "不明なエラーが発生しました";
      await interaction.editReply(`エラーが発生しました: ${message}`);
    }
  }
}
