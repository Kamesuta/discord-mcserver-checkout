import {
  Command,
  RegisterSubCommandGroup,
} from "@kaname-png/plugin-subcommands-advanced";
import { MessageFlags } from "discord.js";
import { pterodactylService } from "@/domain/services/pterodactyl/PterodactylService";
import { serverBindingService } from "@/domain/services/ServerBindingService";
import { logger } from "@/utils/log";

@RegisterSubCommandGroup("mcserver-op", "checkout", (builder) =>
  builder
    .setName("server-status")
    .setDescription("サーバーのステータスを取得")
    .addStringOption((option) =>
      option
        .setName("server")
        .setDescription("サーバー名")
        .setRequired(true)
        .setAutocomplete(true),
    ),
)
export class CheckoutServerStatusCommand extends Command {
  public override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction,
  ) {
    const name = interaction.options.getString("server", true);

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      // サーバー名をPterodactyl IDに変換
      const pteroId = await serverBindingService.resolve(name);

      const status = await pterodactylService.getServerStatus(pteroId);

      // ステータスを日本語に変換
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
    const focusedValue = interaction.options.getFocused();

    // サーバー一覧を取得
    const servers = await serverBindingService.list();

    // 入力値でフィルタリング
    const filtered = servers
      .filter((server) =>
        server.name.toLowerCase().includes(focusedValue.toLowerCase()),
      )
      .slice(0, 25); // Discord APIの制限

    // オートコンプリート候補を返す
    await interaction.respond(
      filtered.map((server) => ({
        name: server.name,
        value: server.name,
      })),
    );
  }
}
