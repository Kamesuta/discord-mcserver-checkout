import {
  Command,
  RegisterSubCommandGroup,
} from "@kaname-png/plugin-subcommands-advanced";
import { MessageFlags } from "discord.js";
import { pterodactylUserService } from "@/domain/services/pterodactyl/PterodactylUserService";
import { logger } from "@/utils/log";

@RegisterSubCommandGroup("ptero", "user", (builder) =>
  builder
    .setName("reset-password")
    .setDescription("ユーザーのパスワードをリセット")
    .addStringOption((option) =>
      option
        .setName("username")
        .setDescription("ニックネーム (半角英数)")
        .setRequired(true),
    ),
)
export class PteroUserResetPasswordCommand extends Command {
  public override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction,
  ) {
    const username = interaction.options.getString("username", true);

    // パスワードを表示するため自分にしか見えないようにする
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      const newPassword = await pterodactylUserService.resetPassword(username);
      await interaction.editReply(
        `「${username}」のパスワードをリセットしました。\n新しいパスワード: \`${newPassword}\``,
      );
    } catch (error) {
      logger.error(error);
      const message =
        error instanceof Error ? error.message : "不明なエラーが発生しました";
      await interaction.editReply(`エラーが発生しました: ${message}`);
    }
  }
}
