import {
  Command,
  RegisterSubCommandGroup,
} from "@kaname-png/plugin-subcommands-advanced";
import { EmbedBuilder, MessageFlags } from "discord.js";
import { commandMentions } from "@/discord-utils/commands.js";
import { rcloneService } from "@/domain/services/RcloneService";
import { workflowAutocomplete } from "@/domain/utils/workflowAutocomplete";
import { WorkflowStatus } from "@/generated/prisma/client";
import { logger } from "@/utils/log";

@RegisterSubCommandGroup("mcserver-op", "archive", (builder) =>
  builder
    .setName("get")
    .setDescription("アーカイブフォルダの共有リンクを取得")
    .addIntegerOption((option) =>
      option
        .setName("id")
        .setDescription(
          `企画ID（${commandMentions.mcserverOpArchiveList.text()}で確認）`,
        )
        .setRequired(true)
        .setAutocomplete(true),
    ),
)
export class ArchiveGetCommand extends Command {
  public override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction,
  ) {
    const workflowId = interaction.options.getInteger("id", true);
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      // 全フォルダを取得して、IDに一致するものを検索
      const folders = await rcloneService.listFolders();
      const targetFolder = folders.find((folder) =>
        folder.startsWith(`ID${workflowId}_`),
      );

      if (!targetFolder) {
        const listCommandMention =
          commandMentions.mcserverOpArchiveList.resolve(interaction.guildId);
        await interaction.editReply(
          `企画ID ${workflowId} のアーカイブが見つかりませんでした。\n` +
            `${listCommandMention} で一覧を確認してください。`,
        );
        return;
      }

      const shareLink = await rcloneService.getShareLink(targetFolder);

      // フォルダ名から情報を抽出
      const match = targetFolder.match(
        /^ID(\d+)_(.+)_(\d{4}-\d{2}-\d{2})_(.+)$/,
      );
      const folderInfo = match
        ? {
            name: match[2],
            date: match[3],
            organizer: match[4],
          }
        : null;

      const embed = new EmbedBuilder()
        .setTitle("アーカイブ共有リンク")
        .setColor(0x2ecc71)
        .addFields(
          ...(folderInfo
            ? [
                { name: "主催者", value: folderInfo.organizer },
                { name: "企画名", value: folderInfo.name, inline: true },
                { name: "申請ID", value: `${workflowId}`, inline: true },
                { name: "日付", value: folderInfo.date, inline: true },
              ]
            : [{ name: "申請ID", value: `${workflowId}`, inline: true }]),
          { name: "フォルダ名", value: `\`${targetFolder}\``, inline: false },
          { name: "共有リンク", value: shareLink, inline: false },
        )
        .setFooter({
          text: "このリンクから企画のバックアップファイルにアクセスできます",
        });

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      logger.error(error);
      const message =
        error instanceof Error ? error.message : "不明なエラーが発生しました";
      const listCommandMention = commandMentions.mcserverOpArchiveList.resolve(
        interaction.guildId,
      );
      await interaction.editReply(
        `共有リンクの取得に失敗しました: ${message}\n\n` +
          `企画IDが正しいか確認してください。\n` +
          `${listCommandMention} で一覧を確認できます。`,
      );
    }
  }

  public override async autocompleteRun(
    interaction: Command.AutocompleteInteraction,
  ) {
    await workflowAutocomplete(interaction, [WorkflowStatus.RETURNED]);
  }
}
