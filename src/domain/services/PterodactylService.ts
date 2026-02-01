import env from "../../utils/env.js";
import { logger } from "../../utils/log.js";

/**
 * Pterodactyl API のサーバーリソース情報のレスポンス型
 */
interface PterodactylServerResources {
  // biome-ignore-start lint/style/useNamingConvention: Pterodactyl API schema
  attributes: {
    /** サーバーの現在の状態 (running, starting, stopping, offline など) */
    current_state: string;
    /** サーバーが一時停止されているかどうか */
    is_suspended: boolean;
    /** サーバーのリソース使用状況 */
    resources: {
      /** メモリ使用量 (バイト) */
      memory_bytes: number;
      /** CPU使用率 (絶対値) */
      cpu_absolute: number;
      /** ディスク使用量 (バイト) */
      disk_bytes: number;
      /** ネットワーク受信量 (バイト) */
      network_rx_bytes: number;
      /** ネットワーク送信量 (バイト) */
      network_tx_bytes: number;
    };
  };
  // biome-ignore-end lint/style/useNamingConvention: Pterodactyl API schema
}

/**
 * Pterodactyl API のユーザー情報のレスポンス型
 */
interface PterodactylUser {
  // biome-ignore-start lint/style/useNamingConvention: Pterodactyl API schema
  attributes: {
    /** ユーザーのUUID */
    uuid: string;
    /** ユーザー名 */
    username: string;
    /** メールアドレス */
    email: string;
    /** プロフィール画像URL */
    image: string;
    /** 二要素認証が有効かどうか */
    "2fa_enabled": boolean;
    /** アカウント作成日時 */
    created_at: string;
    /** ユーザーの権限リスト */
    permissions: string[];
  };
  // biome-ignore-end lint/style/useNamingConvention: Pterodactyl API response
}

/**
 * Pterodactyl API のユーザー一覧レスポンス型
 */
interface ListUsersResponse {
  data: PterodactylUser[];
}

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
 * Pterodactyl API のユーザー作成レスポンス型
 */
interface CreateUserResponse {
  // biome-ignore-start lint/style/useNamingConvention: Pterodactyl API schema
  attributes: {
    id: number;
    external_id: string | null;
    uuid: string;
    username: string;
    email: string;
    first_name: string;
    last_name: string;
    language: string;
    root_admin: boolean;
    "2fa": boolean;
    created_at: string;
    updated_at: string;
  };
  // biome-ignore-end lint/style/useNamingConvention: Pterodactyl API schema
}

/**
 * Pterodactyl API との通信を管理するサービスクラス
 * シングルトンパターンで実装されており、getInstance() で取得する
 */
class PterodactylService {
  /** Pterodactyl API のベースURL */
  private readonly _baseUrl: string = env.PTERODACTYL_BASE_URL;

  /** Pterodactyl Client API キー */
  private readonly _apiKey: string = env.PTERODACTYL_CLIENT_API_KEY;

  /** Pterodactyl Application API キー */
  private readonly _appApiKey: string = env.PTERODACTYL_APP_API_KEY;

  /** カスタムヘッダー (Cloudflare Access など) */
  private readonly _customHeaders: Record<string, string> =
    env.PTERODACTYL_HEADERS;

  /**
   * Pterodactyl API にリクエストを送信する内部メソッド
   * @param endpoint API エンドポイント (/api/client からの相対パス)
   * @param options fetch オプション
   * @returns API レスポンス
   */
  private async _request<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<T> {
    const url = `${this._baseUrl}/api/client${endpoint}`;
    const headers = {
      // biome-ignore-start lint/style/useNamingConvention: Pterodactyl API headers
      Authorization: `Bearer ${this._apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      // biome-ignore-end lint/style/useNamingConvention: Pterodactyl API headers
      ...this._customHeaders,
    };

    const response = await fetch(url, {
      ...options,
      headers: {
        ...headers,
        ...options.headers,
      },
    });

    // エラーレスポンスの処理
    if (!response.ok) {
      const body = await response.text();
      logger.error(
        `Pterodactyl API エラー: ${response.status} ${response.statusText} - ${body}`,
      );
      throw new Error(`Pterodactyl API エラー: ${response.statusText}`);
    }

    // 204 No Content の場合は空オブジェクトを返す
    if (response.status === 204) {
      return {} as T;
    }

    return response.json();
  }

  /**
   * Pterodactyl Application API にリクエストを送信する内部メソッド
   * @param endpoint API エンドポイント (/api/application からの相対パス)
   * @param options fetch オプション
   * @returns API レスポンス
   */
  private async _appRequest<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<T> {
    const url = `${this._baseUrl}/api/application${endpoint}`;
    const headers = {
      // biome-ignore-start lint/style/useNamingConvention: Pterodactyl API headers
      Authorization: `Bearer ${this._appApiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      // biome-ignore-end lint/style/useNamingConvention: Pterodactyl API headers
      ...this._customHeaders,
    };

    const response = await fetch(url, {
      ...options,
      headers: {
        ...headers,
        ...options.headers,
      },
    });

    // エラーレスポンスの処理
    if (!response.ok) {
      const body = await response.text();
      logger.error(
        `Pterodactyl Application API エラー: ${response.status} ${response.statusText} - ${body}`,
      );
      throw new Error(
        `Pterodactyl Application API エラー: ${response.statusText}`,
      );
    }

    // 204 No Content の場合は空オブジェクトを返す
    if (response.status === 204) {
      return {} as T;
    }

    return response.json();
  }

  /**
   * サーバーのステータスを取得
   * @param serverId サーバーID
   * @returns サーバーの現在の状態 (running, offline など)
   */
  public async getServerStatus(serverId: string): Promise<string> {
    try {
      const data = await this._request<PterodactylServerResources>(
        `/servers/${serverId}/resources`,
      );
      return data.attributes.current_state;
    } catch (error) {
      logger.error("サーバーステータスの取得中にエラーが発生しました:", error);
      throw error;
    }
  }

  /**
   * サーバーの電源状態を変更
   * @param serverId サーバーID
   * @param signal 電源操作シグナル (start/stop/restart/kill)
   */
  public async setPowerState(
    serverId: string,
    signal: "start" | "stop" | "restart" | "kill",
  ): Promise<void> {
    try {
      await this._request(`/servers/${serverId}/power`, {
        method: "POST",
        body: JSON.stringify({ signal }),
      });
    } catch (error) {
      logger.error(
        `電源状態を ${signal} に変更中にエラーが発生しました:`,
        error,
      );
      throw error;
    }
  }

  /**
   * サーバーにユーザーを追加
   * デフォルトで通常権限を付与
   * @param serverId サーバーID
   * @param email ユーザーのメールアドレス
   */
  public async addUser(serverId: string, email: string): Promise<void> {
    try {
      // 通常権限のリスト
      // ユーザー管理権限やデータベース権限などは除外
      const permissions = [
        "control.console",
        "control.start",
        "control.stop",
        "control.restart",
        // "user.create",
        // "user.read",
        // "user.update",
        // "user.delete",
        "file.create",
        "file.read",
        "file.read-content",
        "file.update",
        "file.delete",
        "file.archive",
        "file.sftp",
        "backup.create",
        "backup.read",
        "backup.delete",
        "backup.download",
        "backup.restore",
        // "allocation.read",
        // "allocation.create",
        // "allocation.update",
        // "allocation.delete",
        "startup.read",
        "startup.update",
        "startup.docker-image",
        // "database.create",
        // "database.read",
        // "database.update",
        // "database.delete",
        "schedule.create",
        "schedule.read",
        "schedule.update",
        "schedule.delete",
        "settings.rename",
        "settings.reinstall",
        "activity.read",
        "websocket.connect",
      ];

      await this._request(`/servers/${serverId}/users`, {
        method: "POST",
        body: JSON.stringify({ email, permissions }),
      });
    } catch (error) {
      logger.error(`ユーザー ${email} の追加中にエラーが発生しました:`, error);
      throw error;
    }
  }

  /**
   * サーバーからユーザーを削除
   * @param serverId サーバーID
   * @param email ユーザーのメールアドレス
   */
  public async removeUser(serverId: string, email: string): Promise<void> {
    try {
      // サーバー上のユーザー一覧を取得
      const users = await this._request<ListUsersResponse>(
        `/servers/${serverId}/users`,
      );

      // メールアドレスからユーザーを検索
      const user = users.data.find((u) => u.attributes.email === email);

      if (!user) {
        throw new Error(
          `メールアドレス ${email} のユーザーがサーバー ${serverId} に見つかりませんでした`,
        );
      }

      // UUID を使ってユーザーを削除
      await this._request(
        `/servers/${serverId}/users/${user.attributes.uuid}`,
        {
          method: "DELETE",
        },
      );
    } catch (error) {
      logger.error(`ユーザー ${email} の削除中にエラーが発生しました:`, error);
      throw error;
    }
  }

  /**
   * サーバーのバックアップ制限を取得
   * @param serverId サーバーID
   * @returns バックアップの最大数
   */
  public async getBackupLimit(serverId: string): Promise<number> {
    try {
      const data = await this._request<ServerFeatureLimits>(
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
      const data = await this._request<ListBackupsResponse>(
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
      const data = await this._request<PterodactylBackup>(
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
      await this._request(`/servers/${serverId}/backups/${backupUuid}`, {
        method: "DELETE",
      });
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
      const data = await this._request<CreateBackupResponse>(
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
      const { attributes } = await this._request<DownloadBackupResponse>(
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

  /**
   * Pterodactylにユーザーを登録
   * @param nickname ニックネーム (半角英数)
   */
  public async registerUser(nickname: string): Promise<void> {
    try {
      // ニックネームから情報を生成
      await this._appRequest<CreateUserResponse>("/users", {
        method: "POST",
        body: JSON.stringify({
          // biome-ignore-start lint/style/useNamingConvention: Pterodactyl API schema
          email: `${nickname}@kpw.local`,
          username: nickname,
          first_name: nickname,
          last_name: nickname,
          // biome-ignore-end lint/style/useNamingConvention: Pterodactyl API schema
        }),
      });
    } catch (error) {
      logger.error(
        `ユーザー ${nickname} の登録中にエラーが発生しました:`,
        error,
      );
      throw error;
    }
  }

  /**
   * ユーザーのパスワードをリセット
   * @param nickname ニックネーム
   * @returns 新しいパスワード
   */
  public async resetPassword(nickname: string): Promise<string> {
    try {
      // ユーザーを検索
      // biome-ignore-start lint/style/useNamingConvention: Pterodactyl API schema
      const users = await this._appRequest<{
        data: {
          attributes: {
            id: number;
            username: string;
            email: string;
            first_name: string;
            last_name: string;
          };
        }[];
      }>(`/users?filter[username]=${nickname}`);
      // biome-ignore-end lint/style/useNamingConvention: Pterodactyl API schema

      const user = users.data.find(
        (u) => u.attributes.username.toLowerCase() === nickname.toLowerCase(),
      );

      if (!user) {
        throw new Error(`ユーザー \`${nickname}\` が見つかりませんでした。`);
      }

      // ランダムなパスワードを生成 (12文字)
      const newPassword = Math.random().toString(36).slice(-12);

      // パスワードを更新
      await this._appRequest(`/users/${user.attributes.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          // biome-ignore-start lint/style/useNamingConvention: Pterodactyl API schema
          email: user.attributes.email,
          username: user.attributes.username,
          first_name: user.attributes.first_name,
          last_name: user.attributes.last_name,
          password: newPassword,
          // biome-ignore-end lint/style/useNamingConvention: Pterodactyl API schema
        }),
      });

      return newPassword;
    } catch (error) {
      logger.error(
        `ユーザー ${nickname} のパスワードリセット中にエラーが発生しました:`,
        error,
      );
      throw error;
    }
  }
}

/** PterodactylService のシングルトンインスタンス */
export const pterodactylService = new PterodactylService();
