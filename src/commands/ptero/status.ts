import {
  Command,
  RegisterSubCommand,
} from "@kaname-png/plugin-subcommands-advanced";
import { pterodactylService } from "@/domain/services/pterodactyl/PterodactylService";
import { serverBindingService } from "@/domain/services/ServerBindingService";
import { serverBindingAutocomplete } from "@/domain/utils/serverBindingAutocomplete";
import { logger } from "@/utils/log";

@RegisterSubCommand("ptero", (builder) =>
  builder
    .setName("status")
    .setDescription("サーバーのステータスを取得")
    .addStringOption((option) =>
      option
        .setName("server")
        .setDescription("サーバー名")
        .setRequired(true)
        .setAutocomplete(true),
    ),
)
export class PteroStatusCommand extends Command {
  public override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction,
  ) {
    const name = interaction.options.getString("server", true);

    await interaction.deferReply();

    try {
      // サーバー名をPterodactyl IDに変換
      const pteroId = await serverBindingService.resolve(name);

      const status = await pterodactylService.getServerStatus(pteroId);

      const statusMessages: Record<string, string> = {
        running: "稼働中",
        starting: "起動中",
        stopping: "停止中",
        offline: "停止",
      };

      const statusJa = statusMessages[status] || status;

      await interaction.editReply(
        `サーバー \`${name}\` のステータス: **${statusJa}**`,
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
