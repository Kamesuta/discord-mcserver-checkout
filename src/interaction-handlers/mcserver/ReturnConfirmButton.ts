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
import { commandMentions } from "@/discord-utils/commands.js";
import { customIdParams } from "@/discord-utils/customIds";
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
          [customIdParams.workflowId]: String(workflowId),
          [customIdParams.skipReset]: String(skipReset),
          [customIdParams.skipArchive]: String(skipArchive),
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
          [customIdParams.workflowId]: String(workflowId),
          [customIdParams.skipReset]: String(skipReset),
          [customIdParams.skipArchive]: String(skipArchive),
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
    const workflowId = Number(params.get(customIdParams.workflowId));
    const skipReset = params.get(customIdParams.skipReset) === "true";
    const skipArchive = params.get(customIdParams.skipArchive) === "true";

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    // /mcserver が使える人のみ返却できる
    const isGeneral =
      interaction.inCachedGuild() &&
      (await commandMentions.mcserver.checkPermission(interaction.member));
    if (!isGeneral) {
      await interaction.editReply("この操作を実行する権限がありません。");
      return;
    }

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
