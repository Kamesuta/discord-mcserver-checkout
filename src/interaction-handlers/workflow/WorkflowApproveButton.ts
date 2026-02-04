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
  MessageFlags,
} from "discord.js";
import { completeApproval } from "@/domain/flows/ActivationFlow";
import { logger } from "@/utils/log";

@ApplyOptions<InteractionHandler.Options>({
  interactionHandlerType: InteractionHandlerTypes.Button,
})
export class WorkflowApproveButton extends InteractionHandler {
  static build(workflowId: number): ButtonBuilder {
    return new ButtonBuilder()
      .setCustomId(
        `approve-button?${new URLSearchParams({ workflowId: String(workflowId) })}`,
      )
      .setLabel("承認を実行")
      .setStyle(ButtonStyle.Success);
  }

  static buildRetry(workflowId: number): ButtonBuilder {
    return new ButtonBuilder()
      .setCustomId(
        `approve-button?${new URLSearchParams({ workflowId: String(workflowId) })}`,
      )
      .setLabel("再試行")
      .setStyle(ButtonStyle.Primary);
  }

  public override parse(interaction: ButtonInteraction) {
    if (!interaction.customId.startsWith("approve-button")) return this.none();
    return this.some();
  }

  public override async run(interaction: ButtonInteraction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const [, query] = interaction.customId.split("?");
    const workflowId = Number(new URLSearchParams(query).get("workflowId"));

    try {
      await completeApproval(interaction, workflowId);
    } catch (error) {
      logger.error("承認処理中にエラーが発生しました:", error);
      const message =
        error instanceof Error ? error.message : "不明なエラーが発生しました";
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        WorkflowApproveButton.buildRetry(workflowId),
      );
      await interaction.editReply({
        content: `エラーが発生しました: ${message}`,
        components: [row],
      });
    }
  }
}
