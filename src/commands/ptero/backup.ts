import {
  Command,
  RegisterSubCommand,
} from "@kaname-png/plugin-subcommands-advanced";
import { ArchiveName } from "@/domain/services/ArchiveName";
import { archiveService } from "@/domain/services/ArchiveService";
import { logger } from "@/utils/log";

@RegisterSubCommand("ptero", (builder) =>
  builder
    .setName("backup")
    .setDescription("サーバーのバックアップを作成してダウンロード")
    .addStringOption((option) =>
      option.setName("server").setDescription("サーバーID").setRequired(true),
    ),
)
export class PteroBackupCommand extends Command {
  public override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction,
  ) {
    const serverId = interaction.options.getString("server", true);

    await interaction.deferReply();

    try {
      const archiveName = new ArchiveName({
        workflowId: 0,
        workflowName: "Backup",
        organizerName: serverId,
        eventDate: new Date(),
      });
      await archiveService.archiveBackup(serverId, archiveName);

      await interaction.editReply(
        `サーバー \`${serverId}\` のバックアップをアーカイブしました。\n` +
          `ロック済みバックアップと最新状態を rclone で転送し、ロック済みバックアップのロックを解除しました。`,
      );
    } catch (error) {
      logger.error(error);

      const message =
        error instanceof Error ? error.message : "不明なエラーが発生しました";
      await interaction.editReply(`エラーが発生しました: ${message}`);
    }
  }
}
