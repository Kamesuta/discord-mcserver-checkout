import {
  Command,
  RegisterSubCommand,
} from "@kaname-png/plugin-subcommands-advanced";
import { MessageFlags } from "discord.js";
import { createReturnConfirmation } from "@/domain/flows/ReturnFlow";
import { workflowService } from "@/domain/services/WorkflowService";
import { workflowAutocomplete } from "@/domain/utils/workflowAutocomplete";
import { WorkflowStatus } from "@/generated/prisma/client";
import { logger } from "@/utils/log";

@RegisterSubCommand("mcserver", (builder) =>
  builder
    .setName("return")
    .setDescription("自分のサーバーを返却する（主催者のみ）")
    .addIntegerOption((option) =>
      option
        .setName("id")
        .setDescription("申請ID")
        .setRequired(true)
        .setAutocomplete(true),
    ),
)
export class McServerReturnCommand extends Command {
  public override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction,
  ) {
    const id = interaction.options.getInteger("id", true);
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      const workflow = await workflowService.findById(id);
      if (!workflow) {
        await interaction.editReply("申請が見つかりませんでした。");
        return;
      }

      if (
        workflow.status !== WorkflowStatus.ACTIVE ||
        !workflow.pteroServerId
      ) {
        await interaction.editReply(
          "この申請は ACTIVE ではありません。返却できません。",
        );
        return;
      }

      // 主催者チェック
      if (workflow.organizerDiscordId !== interaction.user.id) {
        await interaction.editReply(
          "この申請を返却する権限がありません。\n（主催者のみが返却できます）",
        );
        return;
      }

      // デフォルトではスキップしない
      const skipReset = false;
      const skipArchive = false;

      // 共通の返却確認Embed・ボタンを作成
      const { embed, row } = await createReturnConfirmation(
        workflow,
        skipReset,
        skipArchive,
      );
      await interaction.editReply({ embeds: [embed], components: [row] });
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
    // 自分が主催者のACTIVE申請のみを表示
    await workflowAutocomplete(interaction, [WorkflowStatus.ACTIVE], {
      organizerOnly: true,
    });
  }
}
