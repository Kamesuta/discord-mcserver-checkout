import { execFile } from "node:child_process";
import { promisify } from "node:util";
import env from "@/utils/env.js";
import { logger } from "@/utils/log.js";

const execFileAsync = promisify(execFile);

/**
 * rclone を使用したリモートファイル転送サービス
 */
class RcloneService {
  /**
   * ローカルファイルを rclone リモートにアップロードする
   * @param localPath アップロード対象のローカルファイルパス
   * @param remotePath RCLONE_BASE_PATH 配下のサブパス
   */
  public async upload(localPath: string, remotePath: string): Promise<void> {
    const destination = `${env.RCLONE_BASE_PATH}/${remotePath}`;
    try {
      await execFileAsync("rclone", ["copy", localPath, destination]);
    } catch (error) {
      logger.error(
        `rclone アップロード失敗 (${localPath} → ${destination}):`,
        error,
      );
      throw error;
    }
  }
}

/** RcloneService のシングルトンインスタンス */
export const rcloneService = new RcloneService();
