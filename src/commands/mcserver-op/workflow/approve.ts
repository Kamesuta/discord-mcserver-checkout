import {
  Command,
  RegisterSubCommandGroup,
} from "@kaname-png/plugin-subcommands-advanced";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from "discord.js";
import { userService } from "@/domain/services/UserService";
import { workflowService } from "@/domain/services/WorkflowService";
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

    await interaction.deferReply();

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
        if (!pteroUser) {
          unregistered.push(panelUser.discordId);
        }
      }

      // 申請内容 Embed
      const embed = new EmbedBuilder()
        .setTitle(`申請 ID: ${workflow.id} — ${workflow.name}`)
        .setColor(unregistered.length > 0 ? 0xf39c12 : 0x2ecc71)
        .addFields(
          { name: "申請者", value: `<@${workflow.applicantDiscordId}>` },
          { name: "主催者", value: `<@${workflow.organizerDiscordId}>` },
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
        const params = new URLSearchParams({
          workflowId: String(workflow.id),
          users: unregistered.join(","),
        });
        const button = new ButtonBuilder()
          .setCustomId(`register-button?${params.toString()}`)
          .setLabel("ユーザー登録して承認")
          .setStyle(ButtonStyle.Primary);

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button);
        await interaction.editReply({ embeds: [embed], components: [row] });
      } else {
        const params = new URLSearchParams({
          workflowId: String(workflow.id),
        });
        const button = new ButtonBuilder()
          .setCustomId(`approve-button?${params.toString()}`)
          .setLabel("承認を実行")
          .setStyle(ButtonStyle.Success);

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button);
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
