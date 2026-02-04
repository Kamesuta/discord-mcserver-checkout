import {
  Command,
  RegisterSubCommandGroup,
} from "@kaname-png/plugin-subcommands-advanced";
import { userService } from "@/domain/services/UserService";
import { logger } from "@/utils/log";

@RegisterSubCommandGroup("mcserver-op", "user", (builder) =>
  builder
    .setName("register")
    .setDescription("Pterodactylにユーザーを登録")
    .addStringOption((option) =>
      option
        .setName("username")
        .setDescription("ニックネーム (半角英数)")
        .setRequired(true),
    )
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("登録するDiscordユーザー")
        .setRequired(true),
    ),
)
export class UserRegisterCommand extends Command {
  public override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction,
  ) {
    const username = interaction.options.getString("username", true);
    const user = interaction.options.getUser("user", true);

    await interaction.deferReply();

    try {
      await userService.registerUser(username, user.id, interaction.guild);
      await interaction.editReply(
        `<@${user.id}>を「${username}」として登録しました。`,
      );
    } catch (error) {
      logger.error(error);
      const message =
        error instanceof Error ? error.message : "不明なエラーが発生しました";
      await interaction.editReply(`エラーが発生しました: ${message}`);
    }
  }
}
