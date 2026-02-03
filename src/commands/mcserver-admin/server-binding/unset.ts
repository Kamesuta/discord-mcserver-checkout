import {
  Command,
  RegisterSubCommandGroup,
} from "@kaname-png/plugin-subcommands-advanced";
import { serverBindingService } from "@/domain/services/ServerBindingService";
import { logger } from "@/utils/log";

@RegisterSubCommandGroup("mcserver-admin", "server-binding", (builder) =>
  builder
    .setName("unset")
    .setDescription("サーバーバインディングを削除")
    .addStringOption((option) =>
      option
        .setName("name")
        .setDescription("サーバー名 (例: server01)")
        .setRequired(true),
    ),
)
export class ServerBindingUnsetCommand extends Command {
  public override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction,
  ) {
    const name = interaction.options.getString("name", true);

    await interaction.deferReply();

    try {
      await serverBindingService.unset(name);
      await interaction.editReply(
        `サーバーバインディングを削除しました: \`${name}\``,
      );
    } catch (error) {
      logger.error(error);
      const message =
        error instanceof Error ? error.message : "不明なエラーが発生しました";
      await interaction.editReply(`エラーが発生しました: ${message}`);
    }
  }
}
