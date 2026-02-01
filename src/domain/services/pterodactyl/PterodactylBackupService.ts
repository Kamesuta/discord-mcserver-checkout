import { logger } from "../../../utils/log.js";
import { PterodactylBaseService } from "./PterodactylBaseService.js";

/**
 * Pterodactyl API のバックアップダウンロード (署名URL) レスポンス型
 */
interface DownloadBackupResponse {
  object: string;
  // biome-ignore-start lint/style/useNamingConvention: Pterodactyl API schema
  attributes: {
    /** 署名付きダウンロード URL */
    url: string;
  };
  // biome-ignore-end lint/style/useNamingConvention: Pterodactyl API schema
}

/**
 * Pterodactyl API のバックアップ作成レスポンス型
 */
interface CreateBackupResponse {
  // biome-ignore-start lint/style/useNamingConvention: Pterodactyl API schema
  attributes: {
    /** バックアップのUUID */
    uuid: string;
    /** バックアップ名 */
    name: string;
    /** バックアップがロックされているかどうか */
    is_locked: boolean;
  };
  // biome-ignore-end lint/style/useNamingConvention: Pterodactyl API schema
}

/**
 * Pterodactyl API のバックアップ詳細レスポンス型
 */
interface PterodactylBackup {
  // biome-ignore-start lint/style/useNamingConvention: Pterodactyl API schema
  attributes: {
    /** バックアップのUUID */
    uuid: string;
    /** バックアップ名 */
    name: string;
    /** バックアップがロックされているかどうか */
    is_locked: boolean;
    /** バックアップサイズ (バイト) */
    size: number;
    /** 作成日時 */
    created_at: string;
    /** 完了日時 */
    completed_at: string | null;
    /** バックアップが正常に完了したかどうか */
    is_successful: boolean;
  };
  // biome-ignore-end lint/style/useNamingConvention: Pterodactyl API schema
}

/**
 * Pterodactyl API のバックアップ一覧レスポンス型
 */
interface ListBackupsResponse {
  data: PterodactylBackup[];
}

/**
 * Pterodactyl API のサーバー詳細レスポンス型 (バックアップ制限取得用)
 */
interface ServerFeatureLimits {
  // biome-ignore-start lint/style/useNamingConvention: Pterodactyl API schema
  attributes: {
    feature_limits: {
      backups: number;
    };
  };
  // biome-ignore-end lint/style/useNamingConvention: Pterodactyl API schema
}

/**
 * Pterodactyl のバックアップ操作を管理するサービスクラス
 */
class PterodactylBackupService extends PterodactylBaseService {
  /**
   * サーバーのバックアップ制限を取得
   * @param serverId サーバーID
   * @returns バックアップの最大数
   */
  public async getBackupLimit(serverId: string): Promise<number> {
    try {
      const data = await this._requestClientApi<ServerFeatureLimits>(
        `/servers/${serverId}`,
      );
      return data.attributes.feature_limits.backups;
    } catch (error) {
      logger.error(
        `サーバー ${serverId} のバックアップ制限取得中にエラーが発生しました:`,
        error,
      );
      throw error;
    }
  }

  /**
   * サーバーのバックアップ一覧を取得
   * @param serverId サーバーID
   * @returns バックアップの一覧
   */
  public async listBackups(serverId: string): Promise<PterodactylBackup[]> {
    try {
      const data = await this._requestClientApi<ListBackupsResponse>(
        `/servers/${serverId}/backups`,
      );
      return data.data;
    } catch (error) {
      logger.error(
        `サーバー ${serverId} のバックアップ一覧取得中にエラーが発生しました:`,
        error,
      );
      throw error;
    }
  }

  /**
   * サーバーのバックアップ詳細を取得
   * @param serverId サーバーID
   * @param backupUuid バックアップのUUID
   * @returns バックアップの詳細情報
   */
  public async getBackup(
    serverId: string,
    backupUuid: string,
  ): Promise<PterodactylBackup> {
    try {
      const data = await this._requestClientApi<PterodactylBackup>(
        `/servers/${serverId}/backups/${backupUuid}`,
      );
      return data;
    } catch (error) {
      logger.error(
        `サーバー ${serverId} のバックアップ (${backupUuid}) 詳細取得中にエラーが発生しました:`,
        error,
      );
      throw error;
    }
  }

  /**
   * サーバーのバックアップを削除
   * @param serverId サーバーID
   * @param backupUuid バックアップのUUID
   */
  public async deleteBackup(
    serverId: string,
    backupUuid: string,
  ): Promise<void> {
    try {
      await this._requestClientApi(
        `/servers/${serverId}/backups/${backupUuid}`,
        {
          method: "DELETE",
        },
      );
    } catch (error) {
      logger.error(
        `サーバー ${serverId} のバックアップ (${backupUuid}) 削除中にエラーが発生しました:`,
        error,
      );
      throw error;
    }
  }

  /**
   * サーバーのバックアップを作成
   * @param serverId サーバーID
   * @param name バックアップ名
   * @returns 作成されたバックアップの情報
   */
  public async createBackup(
    serverId: string,
    name: string,
  ): Promise<CreateBackupResponse> {
    try {
      const data = await this._requestClientApi<CreateBackupResponse>(
        `/servers/${serverId}/backups`,
        {
          method: "POST",
          body: JSON.stringify({ name }),
        },
      );
      return data;
    } catch (error) {
      logger.error(
        `サーバー ${serverId} のバックアップ作成中にエラーが発生しました:`,
        error,
      );
      throw error;
    }
  }

  /**
   * サーバーのバックアップをダウンロード
   * バックアップのダウンロード URL を取得し、その内容を ArrayBuffer として返す
   * @param serverId サーバーID
   * @param backupUuid バックアップのUUID
   * @returns ダウンロードされたバックアップのバイナリデータ
   */
  public async downloadBackup(
    serverId: string,
    backupUuid: string,
  ): Promise<ArrayBuffer> {
    try {
      // 署名付きダウンロード URL を取得
      const { attributes } =
        await this._requestClientApi<DownloadBackupResponse>(
          `/servers/${serverId}/backups/${backupUuid}/download`,
        );

      // 取得した署名 URL からバイナリデータをダウンロード
      const fileResponse = await fetch(attributes.url);
      if (!fileResponse.ok) {
        throw new Error(
          `バックアップダウンロード失敗: ${fileResponse.statusText}`,
        );
      }

      return fileResponse.arrayBuffer();
    } catch (error) {
      logger.error(
        `サーバー ${serverId} のバックアップ (${backupUuid}) ダウンロード中にエラーが発生しました:`,
        error,
      );
      throw error;
    }
  }
}

/** PterodactylBackupService のシングルトンインスタンス */
export const pterodactylBackupService = new PterodactylBackupService();
