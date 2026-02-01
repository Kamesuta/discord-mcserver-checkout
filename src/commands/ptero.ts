import { mkdir, writeFile } from "node:fs/promises";
import {
  Command,
  RegisterSubCommand,
  RegisterSubCommandGroup,
  Subcommand,
} from "@kaname-png/plugin-subcommands-advanced";
import { RegisterChatInputCommand } from "@sapphire/decorators";
import { MessageFlags } from "discord.js";
import { pterodactylBackupService } from "@/domain/services/pterodactyl/PterodactylBackupService.js";
import { pterodactylService } from "@/domain/services/pterodactyl/PterodactylService.js";
import { pterodactylUserService } from "@/domain/services/pterodactyl/PterodactylUserService.js";
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
      await pterodactylUserService.addUser(serverId, email);
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
      await pterodactylUserService.registerUser(nickname);
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
      const newPassword = await pterodactylUserService.resetPassword(nickname);
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
 * /ptero backup コマンド
 * サーバーのバックアップを一時的に作成してダウンロード
 * 名前は "[Bot] YYYY-MM-DD HH:mm:ss" で識別可能にする
 * ダウンロード後に一時バックアップは自動削除される
 */
@RegisterSubCommand("ptero", (builder) =>
  builder
    .setName("backup")
    .setDescription("サーバーのバックアップを作成してダウンロード")
    .addStringOption((option) =>
      option.setName("server").setDescription("サーバーID").setRequired(true),
    ),
)
export class PteroBackupCommand extends Command {
  public override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction,
  ) {
    const serverId = interaction.options.getString("server", true);

    await interaction.deferReply();

    let backupUuid: string | null = null;

    try {
      // バックアップ制限と現在の一覧を同時に取得
      const [limit, backups] = await Promise.all([
        pterodactylBackupService.getBackupLimit(serverId),
        pterodactylBackupService.listBackups(serverId),
      ]);

      // 制限に達している場合は一番古いロック済みでないバックアップを削除
      if (backups.length >= limit) {
        const oldest = backups
          .filter((b) => !b.attributes.is_locked)
          .sort(
            (a, b) =>
              new Date(a.attributes.created_at).getTime() -
              new Date(b.attributes.created_at).getTime(),
          )[0];

        if (!oldest) {
          throw new Error(
            "バックアップ制限に達しており、削除可能なバックアップがありません。",
          );
        }

        await pterodactylBackupService.deleteBackup(
          serverId,
          oldest.attributes.uuid,
        );
      }

      // バックアップ名は "[Bot] YYYY-MM-DD HH:mm:ss" 形式
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, "0");
      const backupName =
        `[Bot] ${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ` +
        `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

      // バックアップを作成して完了を待機
      const created = await pterodactylBackupService.createBackup(
        serverId,
        backupName,
      );
      backupUuid = created.response.attributes.uuid;
      await created.wait();

      // ダウンロード
      const data = await pterodactylBackupService.downloadBackup(
        serverId,
        backupUuid,
      );

      // run/backup/ に保存
      const backupDir = getWorkdirPath("backup");
      await mkdir(backupDir, { recursive: true });
      const fileName = `${serverId}_${backupUuid}.tar.gz`;
      const filePath = `${backupDir}/${fileName}`;
      await writeFile(filePath, Buffer.from(data));

      // 一時バックアップを削除
      await pterodactylBackupService.deleteBackup(serverId, backupUuid);
      backupUuid = null;

      await interaction.editReply(
        `サーバー \`${serverId}\` のバックアップをダウンロードしました。\n` +
          `保存先: \`${filePath}\``,
      );
    } catch (error) {
      logger.error(error);

      // エラー時に一時バックアップが残っていたら削除を試みる
      if (backupUuid) {
        try {
          await pterodactylBackupService.deleteBackup(serverId, backupUuid);
        } catch {
          logger.error(
            `一時バックアップ (${backupUuid}) の削除に失敗しました。`,
          );
        }
      }

      const message =
        error instanceof Error ? error.message : "不明なエラーが発生しました";
      await interaction.editReply(`エラーが発生しました: ${message}`);
    }
  }
}

/**
 * /ptero clean コマンド
 * サーバーを初期状態にリセットする
 * 全ファイル削除・MC バージョン設定・再インストールを実行
 */
@RegisterSubCommand("ptero", (builder) =>
  builder
    .setName("clean")
    .setDescription("サーバーを初期状態にリセットする")
    .addStringOption((option) =>
      option.setName("server").setDescription("サーバーID").setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("mc_version")
        .setDescription("リセットするMCバージョン")
        .setRequired(true),
    ),
)
export class PteroCleanCommand extends Command {
  public override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction,
  ) {
    const serverId = interaction.options.getString("server", true);
    const mcVersion = interaction.options.getString("mc_version", true);

    await interaction.deferReply();

    try {
      // サーバーを停止
      await pterodactylService.setPowerState(serverId, "stop");

      // 全ファイルを削除
      await pterodactylService.deleteAllFiles(serverId);

      // Docker イメージを決定
      const dockerImage =
        pterodactylService.getJavaImageForMinecraftVersion(mcVersion);

      // MC バージョンのスタートアップ変数を設定
      await pterodactylService.setStartupVariable(
        serverId,
        "MINECRAFT_VERSION",
        mcVersion,
      );

      // Docker イメージを設定
      await pterodactylService.setDockerImage(serverId, dockerImage);

      // サーバーを再インストール
      await pterodactylService.reinstallServer(serverId);

      await interaction.editReply(
        `サーバー \`${serverId}\` をリセットしました。\n` +
          `- 全ファイル削除 ✓\n` +
          `- MC バージョン: \`${mcVersion}\` に設定 ✓\n` +
          `- Docker イメージ: \`${dockerImage}\` ✓\n` +
          `- 再インストール実行 ✓`,
      );
    } catch (error) {
      logger.error(error);
      const message =
        error instanceof Error ? error.message : "不明なエラーが発生しました";
      await interaction.editReply(`エラーが発生しました: ${message}`);
    }
  }
}
