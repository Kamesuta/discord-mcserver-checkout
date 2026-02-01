import {
  Command,
  RegisterSubCommandGroup,
} from "@kaname-png/plugin-subcommands-advanced";
import { pterodactylUserService } from "@/domain/services/pterodactyl/PterodactylUserService.js";
import { logger } from "@/utils/log.js";

@RegisterSubCommandGroup("ptero", "user", (builder) =>
  builder
    .setName("register")
    .setDescription("Pterodactylにユーザーを登録")
    .addStringOption((option) =>
      option
        .setName("username")
        .setDescription("ニックネーム (半角英数)")
        .setRequired(true),
    ),
)
export class PteroUserRegisterCommand extends Command {
  public override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction,
  ) {
    const username = interaction.options.getString("username", true);

    await interaction.deferReply();

    try {
      await pterodactylUserService.registerUser(username);
      await interaction.editReply(
        `「${username}」のユーザー登録が完了しました。`,
      );
    } catch (error) {
      logger.error(error);
      const message =
        error instanceof Error ? error.message : "不明なエラーが発生しました";
      await interaction.editReply(`エラーが発生しました: ${message}`);
    }
  }
}
