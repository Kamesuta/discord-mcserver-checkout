import {
  Command,
  RegisterSubCommand,
} from "@kaname-png/plugin-subcommands-advanced";
import { pterodactylCleanService } from "@/domain/services/pterodactyl/PterodactylCleanService";
import { logger } from "@/utils/log";

@RegisterSubCommand("ptero", (builder) =>
  builder
    .setName("clean")
    .setDescription("サーバーを初期状態にリセットする")
    .addStringOption((option) =>
      option.setName("server").setDescription("サーバーID").setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("mc-version")
        .setDescription("リセットするMCバージョン")
        .setRequired(true),
    ),
)
export class PteroCleanCommand extends Command {
  public override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction,
  ) {
    const serverId = interaction.options.getString("server", true);
    const mcVersion = interaction.options.getString("mc-version", true);

    await interaction.deferReply();

    try {
      const dockerImage = await pterodactylCleanService.clean(
        serverId,
        mcVersion,
      );

      await interaction.editReply(
        `サーバー \`${serverId}\` をリセットしました。\n` +
          `- 全ファイル削除 ✓\n` +
          `- MC バージョン: \`${mcVersion}\` に設定 ✓\n` +
          `- Docker イメージ: \`${dockerImage}\` ✓\n` +
          `- 再インストール実行 ✓`,
      );
    } catch (error) {
      logger.error(error);
      const message =
        error instanceof Error ? error.message : "不明なエラーが発生しました";
      await interaction.editReply(`エラーが発生しました: ${message}`);
    }
  }
}
