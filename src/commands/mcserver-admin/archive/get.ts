import {
  Command,
  RegisterSubCommandGroup,
} from "@kaname-png/plugin-subcommands-advanced";
import { EmbedBuilder } from "discord.js";
import { rcloneService } from "@/domain/services/RcloneService.js";
import { logger } from "@/utils/log.js";

@RegisterSubCommandGroup("mcserver-admin", "archive", (builder) =>
  builder
    .setName("get")
    .setDescription("アーカイブフォルダの共有リンクを取得")
    .addIntegerOption((option) =>
      option
        .setName("id")
        .setDescription("企画ID（/mcserver_admin archive listで確認）")
        .setRequired(true)
        .setAutocomplete(true),
    ),
)
export class McServerAdminArchiveGetCommand extends Command {
  public override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction,
  ) {
    const workflowId = interaction.options.getInteger("id", true);
    await interaction.deferReply();

    try {
      // 全フォルダを取得して、IDに一致するものを検索
      const folders = await rcloneService.listFolders();
      const targetFolder = folders.find((folder) =>
        folder.startsWith(`ID${workflowId}_`),
      );

      if (!targetFolder) {
        await interaction.editReply(
          `企画ID ${workflowId} のアーカイブが見つかりませんでした。\n` +
            "`/mcserver_admin archive list` で一覧を確認してください。",
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
          { name: "企画ID", value: `${workflowId}`, inline: true },
          ...(folderInfo
            ? [
                { name: "企画名", value: folderInfo.name, inline: true },
                { name: "日付", value: folderInfo.date, inline: true },
                { name: "主催者", value: folderInfo.organizer, inline: false },
              ]
            : []),
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
      await interaction.editReply(
        `共有リンクの取得に失敗しました: ${message}\n\n` +
          `企画IDが正しいか確認してください。\n` +
          `\`/mcserver_admin archive list\` で一覧を確認できます。`,
      );
    }
  }

  public override async autocompleteRun(
    interaction: Command.AutocompleteInteraction,
  ) {
    try {
      const focusedValue = interaction.options.getFocused().toString();
      const folders = await rcloneService.listFolders();

      // IDでパースして、フィルタリング
      const parsedFolders = folders
        .map((folder) => {
          const match = folder.match(/^ID(\d+)_(.+)_(\d{4}-\d{2}-\d{2})_(.+)$/);
          if (match) {
            const [, id, name] = match;
            return { id: Number.parseInt(id, 10), name, folder };
          }
          return null;
        })
        .filter((item): item is NonNullable<typeof item> => item !== null);

      // 入力値でフィルタリング（IDまたは企画名で検索）
      const filtered = parsedFolders
        .filter(
          (item) =>
            item.id.toString().includes(focusedValue) ||
            item.name.toLowerCase().includes(focusedValue.toLowerCase()),
        )
        .slice(0, 25); // Discordの制限

      await interaction.respond(
        filtered.map((item) => ({
          name: `ID: ${item.id} - ${item.name.length > 70 ? `${item.name.substring(0, 67)}...` : item.name}`,
          value: item.id,
        })),
      );
    } catch (error) {
      logger.error("オートコンプリートエラー:", error);
      await interaction.respond([]);
    }
  }
}
