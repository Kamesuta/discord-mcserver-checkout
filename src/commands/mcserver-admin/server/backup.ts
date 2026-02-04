import {
  Command,
  RegisterSubCommandGroup,
} from "@kaname-png/plugin-subcommands-advanced";
import { MessageFlags } from "discord.js";
import { ArchiveName } from "@/domain/services/ArchiveName";
import { archiveService } from "@/domain/services/ArchiveService";
import { serverBindingService } from "@/domain/services/ServerBindingService";
import { serverBindingAutocomplete } from "@/domain/utils/serverBindingAutocomplete";
import { logger } from "@/utils/log";

@RegisterSubCommandGroup("mcserver-admin", "server", (builder) =>
  builder
    .setName("backup")
    .setDescription("サーバーのバックアップを作成してダウンロード")
    .addStringOption((option) =>
      option
        .setName("server")
        .setDescription("サーバー名")
        .setRequired(true)
        .setAutocomplete(true),
    ),
)
export class ServerBackupCommand extends Command {
  public override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction,
  ) {
    const name = interaction.options.getString("server", true);

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      // サーバー名をPterodactyl IDに変換
      const pteroId = await serverBindingService.resolve(name);

      const archiveName = new ArchiveName({
        workflowId: 0,
        workflowName: "Backup",
        organizerName: pteroId,
        eventDate: new Date(),
      });
      await archiveService.archiveBackup(pteroId, archiveName);

      await interaction.editReply(
        `サーバー \`${name}\` のバックアップをアーカイブしました。\n` +
          `ロック済みバックアップと最新状態を rclone で転送し、ロック済みバックアップのロックを解除しました。`,
      );
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
    await serverBindingAutocomplete(interaction);
  }
}
