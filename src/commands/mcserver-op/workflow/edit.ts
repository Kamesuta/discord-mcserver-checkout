import {
  Command,
  RegisterSubCommandGroup,
} from "@kaname-png/plugin-subcommands-advanced";
import { MessageFlags } from "discord.js";
import { workflowService } from "@/domain/services/WorkflowService";
import { workflowAutocomplete } from "@/domain/utils/workflowAutocomplete";
import { WorkflowStatus } from "@/generated/prisma/client";
import { BaseCheckoutModalHandler } from "@/interaction-handlers/workflow/WorkflowBaseModal";

@RegisterSubCommandGroup("mcserver-op", "workflow", (builder) =>
  builder
    .setName("edit")
    .setDescription("PENDING/ACTIVE の申請を編集")
    .addIntegerOption((option) =>
      option
        .setName("id")
        .setDescription("申請ID")
        .setRequired(true)
        .setAutocomplete(true),
    ),
)
export class WorkflowEditCommand extends Command {
  public override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction,
  ) {
    const id = interaction.options.getInteger("id", true);

    const workflow = await workflowService.findById(id);

    if (!workflow) {
      await interaction.reply({
        content: "申請が見つかりませんでした。",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (
      workflow.status !== WorkflowStatus.PENDING &&
      workflow.status !== WorkflowStatus.ACTIVE
    ) {
      await interaction.reply({
        content: "PENDING または ACTIVE の申請のみ編集できます。",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const params = new URLSearchParams({
      workflowId: String(workflow.id),
    });

    const modal = BaseCheckoutModalHandler.build(
      `edit-modal?${params.toString()}`,
      "申請編集",
      {
        name: workflow.name,
        period: String(workflow.periodDays),
        mcVersion: workflow.mcVersion ?? undefined,
        panelUsers: workflow.panelUsers.map((u) => u.discordId),
        description: workflow.description ?? undefined,
      },
    );

    await interaction.showModal(modal);
  }

  public override async autocompleteRun(
    interaction: Command.AutocompleteInteraction,
  ) {
    await workflowAutocomplete(interaction, [
      WorkflowStatus.PENDING,
      WorkflowStatus.ACTIVE,
    ]);
  }
}
