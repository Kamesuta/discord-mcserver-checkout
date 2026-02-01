import {
  Command,
  RegisterSubCommand,
} from "@kaname-png/plugin-subcommands-advanced";
import { pterodactylService } from "@/domain/services/pterodactyl/PterodactylService.js";
import { logger } from "@/utils/log.js";

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
      // サーバーを停止
      await pterodactylService.setPowerState(serverId, "stop");

      // 全ファイルを削除
      await pterodactylService.deleteAllFiles(serverId);

      // Docker イメージを決定
      const dockerImage =
        pterodactylService.getJavaImageForMinecraftVersion(mcVersion);

      // MC バージョンのスタートアップ変数を設定
      await pterodactylService.setStartupVariable(
        serverId,
        "MINECRAFT_VERSION",
        mcVersion,
      );

      // Docker イメージを設定
      await pterodactylService.setDockerImage(serverId, dockerImage);

      // サーバーを再インストール
      await pterodactylService.reinstallServer(serverId);

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
