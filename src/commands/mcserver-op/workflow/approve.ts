import {
  Command,
  RegisterSubCommandGroup,
} from "@kaname-png/plugin-subcommands-advanced";
import { MessageFlags } from "discord.js";
import { createWorkflowApprovalReview } from "@/domain/utils/workflowApprovalReview";
import { workflowAutocomplete } from "@/domain/utils/workflowAutocomplete";
import { WorkflowStatus } from "@/generated/prisma/client";
import { logger } from "@/utils/log";

@RegisterSubCommandGroup("mcserver-op", "workflow", (builder) =>
  builder
    .setName("approve")
    .setDescription("申請を承認する")
    .addIntegerOption((option) =>
      option
        .setName("id")
        .setDescription("申請ID")
        .setRequired(true)
        .setAutocomplete(true),
    ),
)
export class WorkflowApproveCommand extends Command {
  public override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction,
  ) {
    const id = interaction.options.getInteger("id", true);

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      const result = await createWorkflowApprovalReview(id);
      if ("error" in result) {
        await interaction.editReply(result.error);
        return;
      }
      await interaction.editReply({
        embeds: [result.embed],
        components: [result.row],
      });
    } catch (error) {
      logger.error(error);
      const message =
        error instanceof Error ? error.message : "不明なエラーが発生しました";
      await interaction.editReply(`エラーが発生しました: ${message}`);
    }
  }

  public override async autocompleteRun(
    interaction: Command.AutocompleteInteraction,
  ) {
    await workflowAutocomplete(interaction, [WorkflowStatus.PENDING]);
  }
}
