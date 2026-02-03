import {
  Command,
  RegisterSubCommandGroup,
} from "@kaname-png/plugin-subcommands-advanced";
import { pterodactylCleanService } from "@/domain/services/pterodactyl/PterodactylCleanService";
import { serverBindingService } from "@/domain/services/ServerBindingService";
import { serverBindingAutocomplete } from "@/domain/utils/serverBindingAutocomplete";
import { logger } from "@/utils/log";

@RegisterSubCommandGroup("mcserver-admin", "server", (builder) =>
  builder
    .setName("clean")
    .setDescription("サーバーを初期状態にリセットする")
    .addStringOption((option) =>
      option
        .setName("server")
        .setDescription("サーバー名")
        .setRequired(true)
        .setAutocomplete(true),
    )
    .addStringOption((option) =>
      option
        .setName("mc-version")
        .setDescription("リセットするMCバージョン")
        .setRequired(true),
    ),
)
export class ServerCleanCommand extends Command {
  public override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction,
  ) {
    const name = interaction.options.getString("server", true);
    const mcVersion = interaction.options.getString("mc-version", true);

    await interaction.deferReply();

    try {
      // サーバー名をPterodactyl IDに変換
      const pteroId = await serverBindingService.resolve(name);

      const dockerImage = await pterodactylCleanService.reinstall(
        pteroId,
        mcVersion,
      );

      await interaction.editReply(
        `サーバー \`${name}\` をリセットしました。\n` +
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

  public override async autocompleteRun(
    interaction: Command.AutocompleteInteraction,
  ) {
    await serverBindingAutocomplete(interaction);
  }
}
