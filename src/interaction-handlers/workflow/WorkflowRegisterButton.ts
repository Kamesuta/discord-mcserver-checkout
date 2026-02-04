import { ApplyOptions } from "@sapphire/decorators";
import {
  InteractionHandler,
  InteractionHandlerTypes,
} from "@sapphire/framework";
import { ButtonBuilder, type ButtonInteraction, ButtonStyle } from "discord.js";
import { WorkflowRegisterModal } from "@/interaction-handlers/workflow/WorkflowRegisterModal";

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

    const modal = await WorkflowRegisterModal.build(workflowId, users, guild);
    await interaction.showModal(modal);
  }
}
