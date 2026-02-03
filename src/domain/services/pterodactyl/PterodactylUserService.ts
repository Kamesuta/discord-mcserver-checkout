import { PterodactylBaseService } from "@/domain/services/pterodactyl/PterodactylBaseService";
import { logger } from "@/utils/log";

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
 * Pterodactyl のユーザー操作を管理するサービスクラス
 * サーバーへのサブユーザー追加・削除と、アプリレベルのユーザー管理を提供する
 */
class PterodactylUserService extends PterodactylBaseService {
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

      await this._requestClientApi(`/servers/${serverId}/users`, {
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
      const users = await this._requestClientApi<ListUsersResponse>(
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
      await this._requestClientApi(
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
   * Pterodactylにユーザーを登録
   * @param username ニックネーム (半角英数)
   */
  public async registerUser(username: string): Promise<void> {
    try {
      // ニックネームから情報を生成
      await this._requestAppApi<CreateUserResponse>("/users", {
        method: "POST",
        body: JSON.stringify({
          // biome-ignore-start lint/style/useNamingConvention: Pterodactyl API schema
          email: `${username}@kpw.local`,
          username: username,
          first_name: username,
          last_name: username,
          // biome-ignore-end lint/style/useNamingConvention: Pterodactyl API schema
        }),
      });
    } catch (error) {
      logger.error(
        `ユーザー ${username} の登録中にエラーが発生しました:`,
        error,
      );
      throw error;
    }
  }

  /**
   * ユーザーのパスワードをリセット
   * @param username ニックネーム
   * @returns 新しいパスワード
   */
  public async resetPassword(username: string): Promise<string> {
    try {
      // ユーザーを検索
      // biome-ignore-start lint/style/useNamingConvention: Pterodactyl API schema
      const users = await this._requestAppApi<{
        data: {
          attributes: {
            id: number;
            username: string;
            email: string;
            first_name: string;
            last_name: string;
          };
        }[];
      }>(`/users?filter[username]=${username}`);
      // biome-ignore-end lint/style/useNamingConvention: Pterodactyl API schema

      const user = users.data.find(
        (u) => u.attributes.username.toLowerCase() === username.toLowerCase(),
      );

      if (!user) {
        throw new Error(`ユーザー \`${username}\` が見つかりませんでした。`);
      }

      // ランダムなパスワードを生成 (12文字)
      const newPassword = Math.random().toString(36).slice(-12);

      // パスワードを更新
      await this._requestAppApi(`/users/${user.attributes.id}`, {
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
        `ユーザー ${username} のパスワードリセット中にエラーが発生しました:`,
        error,
      );
      throw error;
    }
  }
}

/** PterodactylUserService のシングルトンインスタンス */
export const pterodactylUserService = new PterodactylUserService();
