import {
  Command,
  RegisterSubCommandGroup,
} from "@kaname-png/plugin-subcommands-advanced";
import { MessageFlags } from "discord.js";
import { commandMentions } from "@/discord-utils/commands.js";
import { userService } from "@/domain/services/UserService";
import env from "@/utils/env.js";
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

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      await userService.registerUser(username, user.id, interaction.guild);
      await interaction.editReply(
        `<@${user.id}>を「${username}」として登録しました。`,
      );

      // チャンネルに通知
      const channel = await interaction.client.channels.fetch(
        env.DISCORD_NOTIFY_CHANNEL_ID,
      );
      if (channel?.isSendable()) {
        const resetPasswordMention =
          commandMentions.mcserverResetPassword.resolve(interaction.guildId);
        await channel.send(
          `<@${user.id}> 鯖管理パネルのアカウントが用意できました！\n${resetPasswordMention} でパスワードをリセットしてからログインしてください！`,
        );
      }
    } catch (error) {
      logger.error(error);
      const message =
        error instanceof Error ? error.message : "不明なエラーが発生しました";
      await interaction.editReply(`エラーが発生しました: ${message}`);
    }
  }
}
