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
import { completeReuse } from "@/domain/flows/ReuseFlow";
import { logger } from "@/utils/log";

@ApplyOptions<InteractionHandler.Options>({
  interactionHandlerType: InteractionHandlerTypes.Button,
})
export class ReuseConfirmButton extends InteractionHandler {
  static build(token: string): ButtonBuilder {
    return new ButtonBuilder()
      .setCustomId(
        `reuse-confirm?${new URLSearchParams({
          [customIdParams.reuseToken]: token,
        })}`,
      )
      .setLabel("流用を実行")
      .setStyle(ButtonStyle.Danger);
  }

  static buildRetry(token: string): ButtonBuilder {
    return new ButtonBuilder()
      .setCustomId(
        `reuse-confirm?${new URLSearchParams({
          [customIdParams.reuseToken]: token,
        })}`,
      )
      .setLabel("再試行")
      .setStyle(ButtonStyle.Primary);
  }

  public override parse(interaction: ButtonInteraction) {
    if (!interaction.customId.startsWith("reuse-confirm")) return this.none();
    return this.some();
  }

  public override async run(interaction: ButtonInteraction) {
    const [, query] = interaction.customId.split("?");
    const token = new URLSearchParams(query).get(customIdParams.reuseToken);

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    // /mcserver が使える人のみ流用できる
    const isGeneral =
      interaction.inCachedGuild() &&
      (await commandMentions.mcserver.checkPermission(interaction.member));
    if (!isGeneral) {
      await interaction.editReply("この操作を実行する権限がありません。");
      return;
    }

    if (!token || token === "invalid") {
      await interaction.editReply(
        "流用確認情報が不正です。もう一度やり直してください。",
      );
      return;
    }

    try {
      await completeReuse(interaction, token);
    } catch (error) {
      logger.error("流用処理中にエラーが発生しました:", error);
      const message =
        error instanceof Error ? error.message : "不明なエラーが発生しました";
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        ReuseConfirmButton.buildRetry(token),
      );
      await interaction.editReply({
        content: `エラーが発生しました: ${message}`,
        components: [row],
      });
    }
  }
}
