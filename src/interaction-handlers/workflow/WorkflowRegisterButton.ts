import { ApplyOptions } from "@sapphire/decorators";
import {
  InteractionHandler,
  InteractionHandlerTypes,
} from "@sapphire/framework";
import {
  ButtonBuilder,
  type ButtonInteraction,
  ButtonStyle,
  LabelBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";

@ApplyOptions<InteractionHandler.Options>({
  interactionHandlerType: InteractionHandlerTypes.Button,
})
export class WorkflowRegisterButton extends InteractionHandler {
  static build(workflowId: number, users: string[]): ButtonBuilder {
    return new ButtonBuilder()
      .setCustomId(
        `register-button?${new URLSearchParams({ workflowId: String(workflowId), users: users.join(",") })}`,
      )
      .setLabel("ユーザー登録して承認")
      .setStyle(ButtonStyle.Primary);
  }

  public override parse(interaction: ButtonInteraction) {
    if (!interaction.customId.startsWith("register-button")) return this.none();
    return this.some();
  }

  public override async run(interaction: ButtonInteraction) {
    const [, query] = interaction.customId.split("?");
    const params = new URLSearchParams(query);
    const workflowId = params.get("workflowId") ?? "";
    const users = (params.get("users") ?? "").split(",").filter(Boolean);

    const guild = interaction.guild;
    if (!guild) return;

    const modal = new ModalBuilder()
      .setCustomId(
        `register-modal?workflowId=${workflowId}&users=${users.join(",")}`,
      )
      .setTitle("パネルユーザー登録");

    for (const discordId of users) {
      let label = discordId;
      try {
        const member = await guild.members.fetch(discordId);
        label = member.displayName;
      } catch {
        // ユーザー情報取得失敗時はIDを使用
      }

      modal.addLabelComponents(
        new LabelBuilder()
          .setLabel(`${label} のユーザー名`)
          .setTextInputComponent(
            new TextInputBuilder()
              .setCustomId(`username-${discordId}`)
              .setStyle(TextInputStyle.Short)
              .setPlaceholder("半角英数のみ")
              .setRequired(true),
          ),
      );
    }

    await interaction.showModal(modal);
  }
}
