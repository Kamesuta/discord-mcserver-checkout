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
} from "discord.js";
import { completeReturn } from "@/domain/flows/ReturnFlow";
import { logger } from "@/utils/log";

@ApplyOptions<InteractionHandler.Options>({
  interactionHandlerType: InteractionHandlerTypes.Button,
})
export class ReturnConfirmButton extends InteractionHandler {
  static build(
    workflowId: number,
    skipReset: boolean,
    skipArchive: boolean,
  ): ButtonBuilder {
    return new ButtonBuilder()
      .setCustomId(
        `return-confirm?${new URLSearchParams({
          workflowId: String(workflowId),
          skipReset: String(skipReset),
          skipArchive: String(skipArchive),
        })}`,
      )
      .setLabel("返却を実行")
      .setStyle(ButtonStyle.Danger);
  }

  static buildRetry(
    workflowId: number,
    skipReset: boolean,
    skipArchive: boolean,
  ): ButtonBuilder {
    return new ButtonBuilder()
      .setCustomId(
        `return-confirm?${new URLSearchParams({
          workflowId: String(workflowId),
          skipReset: String(skipReset),
          skipArchive: String(skipArchive),
        })}`,
      )
      .setLabel("再試行")
      .setStyle(ButtonStyle.Primary);
  }

  public override parse(interaction: ButtonInteraction) {
    if (!interaction.customId.startsWith("return-confirm")) return this.none();
    return this.some();
  }

  public override async run(interaction: ButtonInteraction) {
    const [, query] = interaction.customId.split("?");
    const params = new URLSearchParams(query);
    const workflowId = Number(params.get("workflowId"));
    const skipReset = params.get("skipReset") === "true";
    const skipArchive = params.get("skipArchive") === "true";

    await interaction.deferReply();

    try {
      await completeReturn(interaction, workflowId, skipReset, skipArchive);
    } catch (error) {
      logger.error("返却処理中にエラーが発生しました:", error);
      const message =
        error instanceof Error ? error.message : "不明なエラーが発生しました";
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        ReturnConfirmButton.buildRetry(workflowId, skipReset, skipArchive),
      );
      await interaction.editReply({
        content: `エラーが発生しました: ${message}`,
        components: [row],
      });
    }
  }
}
