import { execFile } from "node:child_process";
import { promisify } from "node:util";
import env from "@/utils/env";
import { logger } from "@/utils/log";

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
      await execFileAsync(env.RCLONE_PATH, ["copy", localPath, destination]);
    } catch (error) {
      logger.error(
        `rclone アップロード失敗 (${localPath} → ${destination}):`,
        error,
      );
      throw error;
    }
  }

  /**
   * アーカイブフォルダ一覧を取得する
   * @returns フォルダ名の配列
   */
  public async listFolders(): Promise<string[]> {
    try {
      const { stdout } = await execFileAsync(env.RCLONE_PATH, [
        "lsf",
        "--dirs-only",
        env.RCLONE_BASE_PATH,
      ]);
      return stdout
        .trim()
        .split("\n")
        .filter((line) => line.length > 0)
        .map((line) => line.replace(/\/$/, "")); // 末尾のスラッシュを削除
    } catch (error) {
      logger.error(`rclone フォルダ一覧取得失敗:`, error);
      throw error;
    }
  }

  /**
   * 指定されたパスの共有リンクを取得する
   * @param remotePath RCLONE_BASE_PATH 配下のサブパス
   * @returns 共有リンクURL
   */
  public async getShareLink(remotePath: string): Promise<string> {
    const destination = `${env.RCLONE_BASE_PATH}/${remotePath}`;
    try {
      const { stdout } = await execFileAsync(env.RCLONE_PATH, [
        "link",
        destination,
      ]);
      return stdout.trim();
    } catch (error) {
      logger.error(`rclone 共有リンク取得失敗 (${destination}):`, error);
      throw error;
    }
  }
}

/** RcloneService のシングルトンインスタンス */
export const rcloneService = new RcloneService();
