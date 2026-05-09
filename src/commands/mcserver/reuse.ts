import {
  Command,
  RegisterSubCommand,
} from "@kaname-png/plugin-subcommands-advanced";
import { MessageFlags } from "discord.js";
import { workflowService } from "@/domain/services/WorkflowService";
import { workflowAutocomplete } from "@/domain/utils/workflowAutocomplete";
import { WorkflowStatus } from "@/generated/prisma/client";
import { WorkflowReuseModal } from "@/interaction-handlers/mcserver/WorkflowReuseModal";

@RegisterSubCommand("mcserver", (builder) =>
  builder
    .setName("reuse")
    .setDescription("利用中サーバーを次の企画へ流用する")
    .addIntegerOption((option) =>
      option
        .setName("id")
        .setDescription("流用する申請ID")
        .setRequired(true)
        .setAutocomplete(true),
    ),
)
export class McServerReuseCommand extends Command {
  public override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction,
  ) {
    const workflowId = interaction.options.getInteger("id", true);
    const workflow = await workflowService.findById(workflowId);

    if (!workflow || workflow.status !== WorkflowStatus.ACTIVE) {
      await interaction.reply({
        content: "流用対象のACTIVE申請が見つかりませんでした。",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (workflow.organizerDiscordId !== interaction.user.id) {
      await interaction.reply({
        content: "この申請を流用する権限がありません。",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const modal = WorkflowReuseModal.build(workflow.id, {
      name: workflow.name,
      mcVersion: workflow.mcVersion ?? undefined,
      description: workflow.description ?? undefined,
    });
    await interaction.showModal(modal);
  }

  public override async autocompleteRun(
    interaction: Command.AutocompleteInteraction,
  ) {
    await workflowAutocomplete(interaction, [WorkflowStatus.ACTIVE], {
      organizerOnly: true,
    });
  }
}
