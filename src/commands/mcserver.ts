import {
  Command,
  RegisterSubCommand,
  Subcommand,
} from "@kaname-png/plugin-subcommands-advanced";
import { RegisterChatInputCommand } from "@sapphire/decorators";
import { MessageFlags } from "discord.js";
import { pterodactylUserService } from "../domain/services/pterodactyl/PterodactylUserService.js";
import { BaseCheckoutModalHandler } from "../interaction-handlers/workflow/WorkflowBaseModal.js";
import { logger } from "../utils/log.js";
import { prisma } from "../utils/prisma.js";

/**
 * /mcserver コマンド (親コマンド)
 */
@RegisterChatInputCommand<Subcommand>((builder, command) => {
  command.hooks.subcommands(command, builder);
  return builder
    .setName("mcserver")
    .setDescription("Minecraftサーバー管理コマンド");
})
export class McServerCommand extends Subcommand {}

/**
 * /mcserver checkout コマンド
 * サーバー貸出申請フォームを表示
 */
@RegisterSubCommand("mcserver", (builder) =>
  builder
    .setName("checkout")
    .setDescription("サーバー貸出申請を行う")
    .addUserOption((option) =>
      option.setName("organizer").setDescription("主催者").setRequired(false),
    ),
)
export class McServerCheckoutCommand extends Command {
  public override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction,
  ) {
    const organizer =
      interaction.options.getUser("organizer") ?? interaction.user;

    const params = new URLSearchParams({
      organizerId: organizer.id,
    });

    const modal = BaseCheckoutModalHandler.build(
      `checkout_modal?${params.toString()}`,
      "サーバー貸出申請",
      { panelUsers: [interaction.user.id] },
    );

    await interaction.showModal(modal);
  }
}

/**
 * /mcserver reset_password コマンド
 * Pterodactylのパスワードをリセットする
 */
@RegisterSubCommand("mcserver", (builder) =>
  builder
    .setName("reset_password")
    .setDescription("Pterodactylのパスワードをリセットする"),
)
export class McServerResetPasswordCommand extends Command {
  public override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction,
  ) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    try {
      // 実行者のDiscord IDからPterodactylUserを検索
      const pteroUser = await prisma.pterodactylUser.findUnique({
        where: { discordId: interaction.user.id },
      });

      if (!pteroUser) {
        await interaction.editReply(
          "あなたのPterodactylアカウントが見つかりませんでした。管理者に連絡してください。",
        );
        return;
      }

      const newPassword = await pterodactylUserService.resetPassword(
        pteroUser.username,
      );
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
