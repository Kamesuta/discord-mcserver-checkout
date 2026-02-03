import {
  Command,
  RegisterSubCommand,
} from "@kaname-png/plugin-subcommands-advanced";
import { MessageFlags } from "discord.js";
import { userService } from "@/domain/services/UserService";
import { logger } from "@/utils/log";

@RegisterSubCommand("mcserver", (builder) =>
  builder
    .setName("reset-password")
    .setDescription("Pterodactylのパスワードをリセットする"),
)
export class McServerResetPasswordCommand extends Command {
  public override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction,
  ) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    try {
      // 実行者のDiscord IDからPterodactylUserを検索
      const pteroUser = await userService.findByDiscordId(interaction.user.id);

      if (!pteroUser) {
        await interaction.editReply(
          "あなたのPterodactylアカウントが見つかりませんでした。管理者に連絡してください。",
        );
        return;
      }

      const newPassword = await userService.resetPassword(interaction.user.id);
      await interaction.editReply(
        `パスワードをリセットしました。\n新しいパスワード: \`${newPassword}\``,
      );
    } catch (error) {
      logger.error(error);
      const message =
        error instanceof Error ? error.message : "不明なエラーが発生しました";
      await interaction.editReply(`エラーが発生しました: ${message}`);
    }
  }
}
