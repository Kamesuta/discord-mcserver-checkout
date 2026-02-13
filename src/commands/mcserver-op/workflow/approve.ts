import {
  Command,
  RegisterSubCommandGroup,
} from "@kaname-png/plugin-subcommands-advanced";
import {
  ActionRowBuilder,
  type ButtonBuilder,
  EmbedBuilder,
  MessageFlags,
} from "discord.js";
import { userService } from "@/domain/services/UserService";
import { workflowService } from "@/domain/services/WorkflowService";
import { workflowAutocomplete } from "@/domain/utils/workflowAutocomplete";
import { workflowFields } from "@/domain/utils/workflowFields.js";
import { WorkflowStatus } from "@/generated/prisma/client";
import { WorkflowApproveButton } from "@/interaction-handlers/mcserver-op/WorkflowApproveButton";
import { WorkflowRegisterButton } from "@/interaction-handlers/mcserver-op/WorkflowRegisterButton";
import { WorkflowRejectButton } from "@/interaction-handlers/mcserver-op/WorkflowRejectButton";
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
      const workflow = await workflowService.findById(id);

      if (!workflow) {
        await interaction.editReply("申請が見つかりませんでした。");
        return;
      }

      if (workflow.status !== WorkflowStatus.PENDING) {
        await interaction.editReply("PENDING の申請のみ承認できます。");
        return;
      }

      // 未登録のパネルユーザーを検索
      const unregistered: string[] = [];
      for (const panelUser of workflow.panelUsers) {
        const pteroUser = await userService.findByDiscordId(
          panelUser.discordId,
        );
        // ユーザーレコードが存在しない、または registered が false、または username が未設定の場合は未登録
        if (!pteroUser || !pteroUser.registered || !pteroUser.username) {
          unregistered.push(panelUser.discordId);
        }
      }

      // 申請内容 Embed
      const embed = new EmbedBuilder()
        .setTitle(`申請内容`)
        .setColor(unregistered.length > 0 ? 0xf39c12 : 0x2ecc71)
        .addFields(
          ...workflowFields(workflow),
          {
            name: "パネルユーザー",
            value: workflow.panelUsers
              .map(
                (u) =>
                  `<@${u.discordId}> ${unregistered.includes(u.discordId) ? "⚠️ 未登録" : "✅ 登録済み"}`,
              )
              .join("\n"),
          },
          { name: "バージョン", value: workflow.mcVersion ?? "未指定" },
          { name: "期間", value: `${workflow.periodDays}日` },
        );

      if (workflow.description) {
        embed.addFields({ name: "補足", value: workflow.description });
      }

      // ボタン
      if (unregistered.length > 0) {
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          WorkflowRegisterButton.build(workflow.id, unregistered),
          WorkflowRejectButton.build(workflow.id),
        );
        await interaction.editReply({ embeds: [embed], components: [row] });
      } else {
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          WorkflowApproveButton.build(workflow.id),
          WorkflowRejectButton.build(workflow.id),
        );
        await interaction.editReply({ embeds: [embed], components: [row] });
      }
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
