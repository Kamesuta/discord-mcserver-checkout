import { mkdir, writeFile } from "node:fs/promises";
import {
  Command,
  RegisterSubCommand,
} from "@kaname-png/plugin-subcommands-advanced";
import { pterodactylBackupService } from "@/domain/services/pterodactyl/PterodactylBackupService.js";
import { logger } from "@/utils/log.js";
import { getWorkdirPath } from "@/utils/workdir.js";

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
