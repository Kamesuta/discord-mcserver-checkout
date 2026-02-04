import {
  Command,
  RegisterSubCommandGroup,
} from "@kaname-png/plugin-subcommands-advanced";
import { PaginatedFieldMessageEmbed } from "@sapphire/discord.js-utilities";
import { MessageFlags } from "discord.js";
import { rcloneService } from "@/domain/services/RcloneService";
import { logger } from "@/utils/log";

@RegisterSubCommandGroup("mcserver-op", "archive", (builder) =>
  builder.setName("list").setDescription("アーカイブ済み企画の一覧を表示"),
)
export class ArchiveListCommand extends Command {
  public override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction,
  ) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      const folders = await rcloneService.listFolders();

      // フォルダ名の形式: ID[ID]_[企画名]_YYYY-MM-DD_[主催者名]主催[_MCバージョン]
      // パースできたもののみを抽出
      const parsedFolders = folders
        .map((folderName) => {
          const match = folderName.match(
            /^ID(\d+)_\[(.+)\]_(\d{4}-\d{2}-\d{2})_(.+)$/,
          );
          if (match) {
            const [, id, name, date, organizer] = match;
            return { id, name, date, organizer, folderName };
          }
          return null;
        })
        .filter((item): item is NonNullable<typeof item> => item !== null)
        .sort((a, b) => Number(b.id) - Number(a.id));

      if (parsedFolders.length === 0) {
        await interaction.editReply("アーカイブされた企画はありません。");
        return;
      }

      // PaginatedMessageを使用してページング
      const paginatedMessage = new PaginatedFieldMessageEmbed()
        .setTemplate({
          color: 0x95a5a6,
          title: "アーカイブ済み企画一覧",
          description:
            `全${parsedFolders.length}件のアーカイブが見つかりました。\n` +
            "`/mcserver_admin archive get <企画ID>` で共有リンクを取得できます。",
        })
        .setTitleField("企画一覧")
        .setItems(
          parsedFolders.map(
            (item) =>
              `${item.date}「${item.name}」(ID:${item.id}, ${item.organizer})`,
          ),
        )
        .setItemsPerPage(25)
        .make();

      await paginatedMessage.run(interaction);
    } catch (error) {
      logger.error(error);
      const message =
        error instanceof Error ? error.message : "不明なエラーが発生しました";
      await interaction.editReply(
        `アーカイブ一覧の取得に失敗しました: ${message}`,
      );
    }
  }
}
