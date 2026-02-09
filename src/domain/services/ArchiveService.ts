import { unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ArchiveName } from "@/domain/services/ArchiveName";
import { pterodactylBackupService } from "@/domain/services/pterodactyl/PterodactylBackupService";
import { rcloneService } from "@/domain/services/RcloneService";
import { logger } from "@/utils/log";

/**
 * アーカイブ対象のバックアップ
 */
interface BackupTarget {
  uuid: string;
  createdAt: string;
  supplement?: string;
}

/**
 * バックアップのアーカイブ（ダウンロード → リモート転送）を管理するサービス
 */
class ArchiveService {
  /**
   * サーバーのバックアップをアーカイブする
   * ロック済みバックアップと一時バックアップ（最新ファイル状態）を
   * ダウンロードし rclone で転送し、ロック済みバックアップのロックを解除する
   * @param serverId サーバーID
   * @param archiveName アーカイブの名前構築オブジェクト
   * @param tempBackupSupplement 一時バックアップのファイル名補足（任意）
   */
  public async archiveBackup(
    serverId: string,
    archiveName: ArchiveName,
    tempBackupSupplement?: string,
  ): Promise<void> {
    // バックアップ制限と現在の一覧を同時に取得
    const [limit, backups] = await Promise.all([
      pterodactylBackupService.getBackupLimit(serverId),
      pterodactylBackupService.listBackups(serverId),
    ]);

    // アーカイブ対象のロック済みバックアップ
    const locked = backups.filter((b) => b.attributes.is_locked);

    // 制限に達している場合は、limit未満になるまで古いロック済みでないバックアップを削除
    // 新しいバックアップを作成するスペースを確保するため、limit未満にする必要がある
    const deleteCount = Math.max(0, backups.length - limit + 1);

    if (deleteCount > 0) {
      // 古い順にソートしたロック済みでないバックアップ
      const unlocked = backups
        .filter((b) => !b.attributes.is_locked)
        .sort(
          (a, b) =>
            new Date(a.attributes.created_at).getTime() -
            new Date(b.attributes.created_at).getTime(),
        );

      if (unlocked.length < deleteCount) {
        throw new Error(
          "バックアップ制限に達しており、削除可能なバックアップがありません。",
        );
      }

      // 古い順にdeleteCount個削除
      for (let i = 0; i < deleteCount; i++) {
        await pterodactylBackupService.deleteBackup(
          serverId,
          unlocked[i].attributes.uuid,
        );
      }
    }

    // 一時バックアップを作成（最新ファイル状態をキャプチャ）
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const backupName =
      `[Bot] ${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ` +
      `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

    const created = await pterodactylBackupService.createBackup(
      serverId,
      backupName,
    );
    const tempBackupUuid = created.response.attributes.uuid;
    await created.wait();

    try {
      // アーカイブ対象: ロック済みバックアップ + 一時バックアップ
      const targets: BackupTarget[] = [
        ...locked.map((b) => ({
          uuid: b.attributes.uuid,
          createdAt: b.attributes.created_at,
          supplement: b.attributes.name,
        })),
        {
          uuid: tempBackupUuid,
          createdAt: now.toISOString(),
          supplement: tempBackupSupplement,
        },
      ];

      for (const target of targets) {
        await this._downloadAndUpload(serverId, target, archiveName);
      }

      // 全ロック済みバックアップのロック解除
      for (const backup of locked) {
        await pterodactylBackupService.toggleLock(
          serverId,
          backup.attributes.uuid,
        );
      }
    } finally {
      // 一時バックアップを削除
      try {
        await pterodactylBackupService.deleteBackup(serverId, tempBackupUuid);
      } catch {
        logger.error(
          `一時バックアップ (${tempBackupUuid}) の削除に失敗しました。`,
        );
      }
    }
  }

  /**
   * バックアップをダウンロードし rclone で転送する
   */
  private async _downloadAndUpload(
    serverId: string,
    backup: BackupTarget,
    archiveName: ArchiveName,
  ): Promise<void> {
    // ファイル名: [バックアップの日付][_補足].tar.gz
    const fileName = archiveName.getFileName(
      backup.createdAt,
      backup.supplement,
    );
    // 一時フォルダにダウンロード
    const localPath = join(tmpdir(), fileName);

    try {
      const data = await pterodactylBackupService.downloadBackup(
        serverId,
        backup.uuid,
      );
      await writeFile(localPath, Buffer.from(data));
      // フォルダ名/ 配下にファイルをアップロード
      await rcloneService.upload(localPath, archiveName.getFolderName());
    } finally {
      try {
        await unlink(localPath);
      } catch {
        logger.error(`一時バックアップファイル削除失敗: ${localPath}`);
      }
    }
  }
}

/** ArchiveService のシングルトンインスタンス */
export const archiveService = new ArchiveService();
