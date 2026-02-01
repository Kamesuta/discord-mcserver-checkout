import {
  Command,
  RegisterSubCommand,
  RegisterSubCommandGroup,
  Subcommand,
} from "@kaname-png/plugin-subcommands-advanced";
import { RegisterChatInputCommand } from "@sapphire/decorators";
import { pterodactylService } from "@/domain/services/pterodactyl/PterodactylService.js";
import { serverBindingService } from "@/domain/services/ServerBindingService.js";
import type { ServerBinding } from "@/generated/prisma/browser.js";
import { logger } from "../utils/log.js";

/**
 * /mcserver_admin コマンド (親コマンド)
 * Minecraftサーバー管理のための管理者コマンドグループ
 */
@RegisterChatInputCommand<Subcommand>((builder, command) => {
  // サブコマンドグループ (hooksの前に設定する必要あり)
  builder.addSubcommandGroup((group) =>
    group.setName("server_binding").setDescription("サーバーエイリアス管理"),
  );

  // コマンドの登録
  command.hooks.groups(command, builder);
  command.hooks.subcommands(command, builder);
  return builder
    .setName("mcserver_admin")
    .setDescription("Minecraftサーバー管理者コマンド");
})
export class McServerAdminCommand extends Subcommand {}

/**
 * /mcserver_admin server_binding list コマンド
 * すべてのサーバーバインディングを一覧表示
 */
@RegisterSubCommandGroup("mcserver_admin", "server_binding", (builder) =>
  builder.setName("list").setDescription("サーバーバインディング一覧を表示"),
)
export class McServerAdminServerBindingListCommand extends Command {
  public override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction,
  ) {
    await interaction.deferReply();

    try {
      const bindings = await serverBindingService.list();

      if (bindings.length === 0) {
        await interaction.editReply(
          "登録されているサーバーバインディングはありません。",
        );
        return;
      }

      const list = bindings
        .map((b: ServerBinding) => `• \`${b.name}\` → \`${b.pteroId}\``)
        .join("\n");

      await interaction.editReply(
        `**サーバーバインディング一覧** (${bindings.length}件)\n\n${list}`,
      );
    } catch (error) {
      logger.error(error);
      const message =
        error instanceof Error ? error.message : "不明なエラーが発生しました";
      await interaction.editReply(`エラーが発生しました: ${message}`);
    }
  }
}

/**
 * /mcserver_admin server_binding set コマンド
 * サーバーバインディングを設定
 */
@RegisterSubCommandGroup("mcserver_admin", "server_binding", (builder) =>
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
        .setName("ptero_id")
        .setDescription("Pterodactyl サーバーID (例: 354dc039)")
        .setRequired(true),
    ),
)
export class McServerAdminServerBindingSetCommand extends Command {
  public override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction,
  ) {
    const name = interaction.options.getString("name", true);
    const pteroId = interaction.options.getString("ptero_id", true);

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

/**
 * /mcserver_admin server_binding unset コマンド
 * サーバーバインディングを削除
 */
@RegisterSubCommandGroup("mcserver_admin", "server_binding", (builder) =>
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
export class McServerAdminServerBindingUnsetCommand extends Command {
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

/**
 * /mcserver_admin status コマンド
 * サーバーのステータスを取得
 */
@RegisterSubCommand("mcserver_admin", (builder) =>
  builder
    .setName("status")
    .setDescription("サーバーのステータスを取得")
    .addStringOption((option) =>
      option.setName("server").setDescription("サーバー名").setRequired(true),
    ),
)
export class McServerAdminStatusCommand extends Command {
  public override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction,
  ) {
    const name = interaction.options.getString("server", true);

    await interaction.deferReply();

    try {
      // サーバー名をPterodactyl IDに変換
      const pteroId = await serverBindingService.resolve(name);

      const status = await pterodactylService.getServerStatus(pteroId);

      // ステータスを日本語に変換
      const statusMessages: Record<string, string> = {
        running: "稼働中",
        starting: "起動中",
        stopping: "停止中",
        offline: "停止",
      };

      const statusJa = statusMessages[status] || status;

      await interaction.editReply(
        `サーバー \`${name}\` のステータス: **${statusJa}**`,
      );
    } catch (error) {
      logger.error(error);
      const message =
        error instanceof Error ? error.message : "不明なエラーが発生しました";
      await interaction.editReply(`エラーが発生しました: ${message}`);
    }
  }
}
