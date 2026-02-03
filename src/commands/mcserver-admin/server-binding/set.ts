import {
  Command,
  RegisterSubCommandGroup,
} from "@kaname-png/plugin-subcommands-advanced";
import { serverBindingService } from "@/domain/services/ServerBindingService";
import { logger } from "@/utils/log";

@RegisterSubCommandGroup("mcserver-admin", "server-binding", (builder) =>
  builder
    .setName("set")
    .setDescription("サーバーバインディングを設定")
    .addStringOption((option) =>
      option
        .setName("name")
        .setDescription("サーバー名 (例: server01)")
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("ptero-id")
        .setDescription("Pterodactyl サーバーID (例: 354dc039)")
        .setRequired(true),
    ),
)
export class McServerAdminServerBindingSetCommand extends Command {
  public override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction,
  ) {
    const name = interaction.options.getString("name", true);
    const pteroId = interaction.options.getString("ptero-id", true);

    await interaction.deferReply();

    try {
      await serverBindingService.set(name, pteroId);
      await interaction.editReply(
        `サーバーバインディングを設定しました: \`${name}\` → \`${pteroId}\``,
      );
    } catch (error) {
      logger.error(error);
      const message =
        error instanceof Error ? error.message : "不明なエラーが発生しました";
      await interaction.editReply(`エラーが発生しました: ${message}`);
    }
  }
}
