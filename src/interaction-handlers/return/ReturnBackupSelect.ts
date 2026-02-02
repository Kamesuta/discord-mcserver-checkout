import { ApplyOptions } from "@sapphire/decorators";
import {
  InteractionHandler,
  InteractionHandlerTypes,
} from "@sapphire/framework";
import type { ButtonInteraction } from "discord.js";
import {
  LabelBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";

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
    const workflowId = params.get("workflowId") ?? "";

    const modalParams = new URLSearchParams({ workflowId });
    const modal = new ModalBuilder()
      .setCustomId(`return-modal?${modalParams.toString()}`)
      .setTitle("返却処理の確認");

    modal.addLabelComponents(
      new LabelBuilder()
        .setLabel("返却日")
        .setDescription("例: 2025/01/15")
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId("date")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("YYYY/MM/DD")
            .setRequired(true),
        ),
    );

    modal.addLabelComponents(
      new LabelBuilder()
        .setLabel("補足コメント (任意)")
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId("comment")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false),
        ),
    );

    await interaction.showModal(modal);
  }
}
