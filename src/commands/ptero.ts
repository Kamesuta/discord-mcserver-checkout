import { mkdir, writeFile } from "node:fs/promises";
import {
  Command,
  RegisterSubCommand,
  RegisterSubCommandGroup,
  Subcommand,
} from "@kaname-png/plugin-subcommands-advanced";
import { RegisterChatInputCommand } from "@sapphire/decorators";
import { MessageFlags } from "discord.js";
import { pterodactylService } from "@/domain/services/PterodactylService.js";
import { logger } from "../utils/log.js";
import { getWorkdirPath } from "../utils/workdir.js";

/**
 * /ptero コマンド (親コマンド)
 * Pterodactylサーバーを管理するためのコマンドグループ
 */
@RegisterChatInputCommand<Subcommand>((builder, command) => {
  // サブコマンドグループ (hooksの前に設定する必要あり)
  builder.addSubcommandGroup((group) =>
    group.setName("user").setDescription("ユーザー管理"),
  );
  builder.addSubcommandGroup((group) =>
    group.setName("backup").setDescription("バックアップ管理"),
  );

  // コマンドの登録
  command.hooks.groups(command, builder);
  command.hooks.subcommands(command, builder);
  return builder
    .setName("ptero")
    .setDescription("Pterodactylサーバー管理コマンド");
})
export class PteroCommand extends Subcommand {
  /**
   * 親コマンドのインスタンスを取得するヘルパーメソッド
   * サブコマンドから共通処理を呼び出す際に使用
   */
  public static get(that: Command): PteroCommand {
    return that.container.stores.get("commands").get("ptero") as PteroCommand;
  }

  /**
   * サーバーの電源操作を行う共通処理
   * @param interaction Discord インタラクション
   * @param signal 電源操作シグナル (start/stop/restart/kill)
   */
  public async handlePowerCommand(
    interaction: Command.ChatInputCommandInteraction,
    signal: "start" | "stop" | "restart" | "kill",
  ) {
    const serverId = interaction.options.getString("server", true);

    await interaction.deferReply();

    try {
      await pterodactylService.setPowerState(serverId, signal);

      // シグナルに応じた日本語メッセージ
      const signalMessages = {
        start: "起動",
        stop: "停止",
        restart: "再起動",
        kill: "強制終了",
      };

      await interaction.editReply(
        `サーバー \`${serverId}\` に **${signalMessages[signal]}** シグナルを送信しました。`,
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
 * /ptero status コマンド
 * サーバーの現在のステータスを取得して表示
 */
@RegisterSubCommand("ptero", (builder) =>
  builder
    .setName("status")
    .setDescription("サーバーのステータスを取得")
    .addStringOption((option) =>
      option.setName("server").setDescription("サーバーID").setRequired(true),
    ),
)
export class PteroStatusCommand extends Command {
  public override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction,
  ) {
    const serverId = interaction.options.getString("server", true);

    await interaction.deferReply();

    try {
      const status = await pterodactylService.getServerStatus(serverId);

      // ステータスを日本語に変換
      const statusMessages: Record<string, string> = {
        running: "稼働中",
        starting: "起動中",
        stopping: "停止中",
        offline: "停止",
      };

      const statusJa = statusMessages[status] || status;

      await interaction.editReply(
        `サーバー \`${serverId}\` のステータス: **${statusJa}**`,
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
 * /ptero start コマンド
 * サーバーを起動
 */
@RegisterSubCommand("ptero", (builder) =>
  builder
    .setName("start")
    .setDescription("サーバーを起動")
    .addStringOption((option) =>
      option.setName("server").setDescription("サーバーID").setRequired(true),
    ),
)
export class PteroStartCommand extends Command {
  public override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction,
  ) {
    await PteroCommand.get(this).handlePowerCommand(interaction, "start");
  }
}

/**
 * /ptero stop コマンド
 * サーバーを停止
 */
@RegisterSubCommand("ptero", (builder) =>
  builder
    .setName("stop")
    .setDescription("サーバーを停止")
    .addStringOption((option) =>
      option.setName("server").setDescription("サーバーID").setRequired(true),
    ),
)
export class PteroStopCommand extends Command {
  public override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction,
  ) {
    await PteroCommand.get(this).handlePowerCommand(interaction, "stop");
  }
}

/**
 * /ptero restart コマンド
 * サーバーを再起動
 */
@RegisterSubCommand("ptero", (builder) =>
  builder
    .setName("restart")
    .setDescription("サーバーを再起動")
    .addStringOption((option) =>
      option.setName("server").setDescription("サーバーID").setRequired(true),
    ),
)
export class PteroRestartCommand extends Command {
  public override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction,
  ) {
    await PteroCommand.get(this).handlePowerCommand(interaction, "restart");
  }
}

/**
 * /ptero kill コマンド
 * サーバーを強制終了
 */
@RegisterSubCommand("ptero", (builder) =>
  builder
    .setName("kill")
    .setDescription("サーバーを強制終了")
    .addStringOption((option) =>
      option.setName("server").setDescription("サーバーID").setRequired(true),
    ),
)
export class PteroKillCommand extends Command {
  public override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction,
  ) {
    await PteroCommand.get(this).handlePowerCommand(interaction, "kill");
  }
}

/**
 * /ptero user add コマンド
 * サーバーにユーザーを追加
 */
@RegisterSubCommandGroup("ptero", "user", (builder) =>
  builder
    .setName("add")
    .setDescription("サーバーにユーザーを追加")
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
export class PteroUserAddCommand extends Command {
  public override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction,
  ) {
    const serverId = interaction.options.getString("server", true);
    const email = interaction.options.getString("email", true);

    await interaction.deferReply();

    try {
      await pterodactylService.addUser(serverId, email);
      await interaction.editReply(
        `ユーザー \`${email}\` をサーバー \`${serverId}\` に追加しました。`,
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
 * /ptero user remove コマンド
 * サーバーからユーザーを削除
 */
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
      await pterodactylService.removeUser(serverId, email);
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

/**
 * /ptero user register コマンド
 * Pterodactylにユーザーを登録
 */
@RegisterSubCommandGroup("ptero", "user", (builder) =>
  builder
    .setName("register")
    .setDescription("Pterodactylにユーザーを登録")
    .addStringOption((option) =>
      option
        .setName("nickname")
        .setDescription("ニックネーム (半角英数)")
        .setRequired(true),
    ),
)
export class PteroUserRegisterCommand extends Command {
  public override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction,
  ) {
    const nickname = interaction.options.getString("nickname", true);

    await interaction.deferReply();

    try {
      await pterodactylService.registerUser(nickname);
      await interaction.editReply(
        `「${nickname}」のユーザー登録が完了しました。`,
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
 * /ptero user reset_password コマンド
 * ユーザーのパスワードをリセット
 */
@RegisterSubCommandGroup("ptero", "user", (builder) =>
  builder
    .setName("reset_password")
    .setDescription("ユーザーのパスワードをリセット")
    .addStringOption((option) =>
      option
        .setName("nickname")
        .setDescription("ニックネーム (半角英数)")
        .setRequired(true),
    ),
)
export class PteroUserResetPasswordCommand extends Command {
  public override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction,
  ) {
    const nickname = interaction.options.getString("nickname", true);

    // パスワードを表示するため自分にしか見えないようにする
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      const newPassword = await pterodactylService.resetPassword(nickname);
      await interaction.editReply(
        `「${nickname}」のパスワードをリセットしました。\n新しいパスワード: \`${newPassword}\``,
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
 * /ptero backup create コマンド
 * サーバーのバックアップを作成
 */
@RegisterSubCommandGroup("ptero", "backup", (builder) =>
  builder
    .setName("create")
    .setDescription("サーバーのバックアップを作成")
    .addStringOption((option) =>
      option.setName("server").setDescription("サーバーID").setRequired(true),
    )
    .addStringOption((option) =>
      option.setName("name").setDescription("バックアップ名").setRequired(true),
    ),
)
export class PteroBackupCreateCommand extends Command {
  public override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction,
  ) {
    const serverId = interaction.options.getString("server", true);
    const name = interaction.options.getString("name", true);

    await interaction.deferReply();

    try {
      const backup = await pterodactylService.createBackup(serverId, name);
      await interaction.editReply(
        `サーバー \`${serverId}\` のバックアップ \`${backup.attributes.name}\` を作成しました。\n` +
          `UUID: \`${backup.attributes.uuid}\``,
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
 * /ptero backup download コマンド
 * サーバーのバックアップをダウンロード
 * ダウンロード先: run/backup/
 */
@RegisterSubCommandGroup("ptero", "backup", (builder) =>
  builder
    .setName("download")
    .setDescription("サーバーのバックアップをダウンロード")
    .addStringOption((option) =>
      option.setName("server").setDescription("サーバーID").setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("name")
        .setDescription("バックアップのUUID")
        .setRequired(true),
    ),
)
export class PteroBackupDownloadCommand extends Command {
  public override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction,
  ) {
    const serverId = interaction.options.getString("server", true);
    const backupUuid = interaction.options.getString("name", true);

    await interaction.deferReply();

    try {
      const data = await pterodactylService.downloadBackup(
        serverId,
        backupUuid,
      );

      // ダウンロード先ディレクトリを作成
      const backupDir = getWorkdirPath("backup");
      await mkdir(backupDir, { recursive: true });

      // ファイル名はサーバーID_バックアップUUID.tar.gz
      const fileName = `${serverId}_${backupUuid}.tar.gz`;
      const filePath = `${backupDir}/${fileName}`;
      await writeFile(filePath, Buffer.from(data));

      await interaction.editReply(
        `サーバー \`${serverId}\` のバックアップをダウンロードしました。\n` +
          `保存先: \`${filePath}\``,
      );
    } catch (error) {
      logger.error(error);
      const message =
        error instanceof Error ? error.message : "不明なエラーが発生しました";
      await interaction.editReply(`エラーが発生しました: ${message}`);
    }
  }
}
