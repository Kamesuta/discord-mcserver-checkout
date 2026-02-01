import {
  Command,
  RegisterSubCommand,
  Subcommand,
} from "@kaname-png/plugin-subcommands-advanced";
import { RegisterChatInputCommand } from "@sapphire/decorators";
import {
  LabelBuilder,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  UserSelectMenuBuilder,
} from "discord.js";
import { pterodactylUserService } from "../domain/services/pterodactyl/PterodactylUserService.js";
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

    const modal = new ModalBuilder()
      .setCustomId(`checkout_modal?${params.toString()}`)
      .setTitle("サーバー貸出申請");

    modal.addLabelComponents(
      new LabelBuilder()
        .setLabel("サーバーの用途/企画名")
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId("name")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("例: 01/01 マイクラ正月福笑い")
            .setRequired(true),
        ),
    );

    modal.addLabelComponents(
      new LabelBuilder()
        .setLabel("貸出希望期間 (日数)")
        .setDescription(
          "イベント準備用の場合、イベントまでの日数を入力してください",
        )
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId("period")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("例: 30")
            .setRequired(true),
        ),
    );

    modal.addLabelComponents(
      new LabelBuilder()
        .setLabel("Minecraft バージョン")
        .setDescription("空の場合、最新版が設定されます")
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId("mc_version")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("例: 1.20.1")
            .setRequired(false),
        ),
    );

    modal.addLabelComponents(
      new LabelBuilder()
        .setLabel("パネル権限を付与する人")
        .setUserSelectMenuComponent(
          new UserSelectMenuBuilder()
            .setCustomId("panel_users")
            .setDefaultUsers(interaction.user.id) // デフォルトは申請者
            .setMinValues(1)
            .setMaxValues(10)
            .setRequired(true),
        ),
    );

    modal.addLabelComponents(
      new LabelBuilder()
        .setLabel("補足説明 (任意)")
        .setDescription(
          "イベント準備以外の申請の場合は、企画発足フォーラムへのリンクを記載してください",
        )
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId("description")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false),
        ),
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
