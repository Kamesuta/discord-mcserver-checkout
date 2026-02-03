import {
  Command,
  RegisterSubCommandGroup,
} from "@kaname-png/plugin-subcommands-advanced";
import { pterodactylUserService } from "@/domain/services/pterodactyl/PterodactylUserService";
import { logger } from "@/utils/log";

@RegisterSubCommandGroup("ptero", "user", (builder) =>
  builder
    .setName("remove")
    .setDescription("サーバーからユーザーを削除")
    .addStringOption((option) =>
      option.setName("server").setDescription("サーバーID").setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("email")
        .setDescription("ユーザーのメールアドレス")
        .setRequired(true),
    ),
)
export class PteroUserRemoveCommand extends Command {
  public override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction,
  ) {
    const serverId = interaction.options.getString("server", true);
    const email = interaction.options.getString("email", true);

    await interaction.deferReply();

    try {
      await pterodactylUserService.removeUser(serverId, email);
      await interaction.editReply(
        `ユーザー \`${email}\` をサーバー \`${serverId}\` から削除しました。`,
      );
    } catch (error) {
      logger.error(error);
      const message =
        error instanceof Error ? error.message : "不明なエラーが発生しました";
      await interaction.editReply(`エラーが発生しました: ${message}`);
    }
  }
}
