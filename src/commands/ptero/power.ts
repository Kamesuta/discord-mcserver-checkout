import {
  Command,
  RegisterSubCommand,
} from "@kaname-png/plugin-subcommands-advanced";
import { pterodactylService } from "@/domain/services/pterodactyl/PterodactylService.js";
import { logger } from "@/utils/log.js";

@RegisterSubCommand("ptero", (builder) =>
  builder
    .setName("power")
    .setDescription("サーバーの電源操作")
    .addStringOption((option) =>
      option.setName("server").setDescription("サーバーID").setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("signal")
        .setDescription("電源操作シグナル")
        .setRequired(true)
        .addChoices(
          { name: "起動", value: "start" },
          { name: "停止", value: "stop" },
          { name: "再起動", value: "restart" },
          { name: "強制終了", value: "kill" },
        ),
    ),
)
export class PteroPowerCommand extends Command {
  public override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction,
  ) {
    const serverId = interaction.options.getString("server", true);
    const signal = interaction.options.getString("signal", true) as
      | "start"
      | "stop"
      | "restart"
      | "kill";

    await interaction.deferReply();

    try {
      await pterodactylService.setPowerState(serverId, signal);

      const signalMessages = {
        start: "起動",
        stop: "停止",
        restart: "再起動",
        kill: "強制終了",
      };

      await interaction.editReply(
        `サーバー \`${serverId}\` に **${signalMessages[signal]}** シグナルを送信しました。`,
      );
    } catch (error) {
      logger.error(error);
      const message =
        error instanceof Error ? error.message : "不明なエラーが発生しました";
      await interaction.editReply(`エラーが発生しました: ${message}`);
    }
  }
}
