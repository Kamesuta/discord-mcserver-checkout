import { logger } from "@/utils/log";
import { PterodactylBaseService } from "./PterodactylBaseService.js";

/**
 * Pterodactyl API のスタートアップ変数レスポンス型
 */
interface StartupVariablesResponse {
  data: {
    // biome-ignore-start lint/style/useNamingConvention: Pterodactyl API schema
    attributes: {
      /** 変数の env 名（環境変数名） */
      env_variable: string;
      /** 変数の現在値 */
      server_value: string;
    };
    // biome-ignore-end lint/style/useNamingConvention: Pterodactyl API schema
  }[];
}

/**
 * version_history.json のフォーマット
 */
interface VersionHistory {
  oldVersion?: string;
  currentVersion?: string;
}

/**
 * Pterodactyl のサーバー起動変数やファイル情報を取得するサービスクラス
 */
class PterodactylStartupService extends PterodactylBaseService {
  /**
   * サーバーのスタートアップ変数を取得
   * @param serverId サーバーID
   * @param key 取得する変数のキー（環境変数名）
   * @returns 変数の値。見つからない場合は undefined
   */
  private async _getStartupVariable(
    serverId: string,
    key: string,
  ): Promise<string | undefined> {
    try {
      const data = await this._requestClientApi<StartupVariablesResponse>(
        `/servers/${serverId}/startup`,
      );
      const variable = data.data.find((v) => v.attributes.env_variable === key);
      return variable?.attributes.server_value;
    } catch (error) {
      logger.error(
        `サーバー ${serverId} のスタートアップ変数取得中にエラーが発生しました:`,
        error,
      );
      return undefined;
    }
  }

  /**
   * version_history.json から currentVersion を抽出
   * @param content ファイルの内容
   * @returns currentVersion の値。抽出できない場合は undefined
   */
  private _parseVersionHistory(content: string): string | undefined {
    try {
      const data: VersionHistory = JSON.parse(content);
      return data.currentVersion;
    } catch {
      return undefined;
    }
  }

  /**
   * currentVersion 文字列から MC バージョンを抽出
   * 例: "git-Paper-497 (MC: 1.20.4)" → "1.20.4"
   * @param currentVersion version_history.json の currentVersion
   * @returns MC バージョン。抽出できない場合は undefined
   */
  private _extractMcVersion(currentVersion: string): string | undefined {
    const match = currentVersion.match(/MC:\s*([0-9.]+)/);
    return match?.[1];
  }

  /**
   * サーバーの Minecraft バージョンを優先順位に従って取得する
   *
   * 優先順位：
   * 1. version_history.json の currentVersion（ファイルがない/パース失敗の場合は次へ）
   * 2. Pterodactyl の MINECRAFT_VERSION 起動変数（空または "latest" の場合は次へ）
   * 3. fallbackVersion（DBに記録されているバージョンなど）
   * 4. undefined
   *
   * @param serverId サーバーID
   * @param fallbackVersion フォールバックバージョン（通常はDBのmcVersion）
   * @returns Minecraft バージョン
   */
  public async getMinecraftVersion(
    serverId: string,
    fallbackVersion?: string,
  ): Promise<string | undefined> {
    // 1. version_history.json から取得
    const versionHistoryContent = await this._readFileContent(
      serverId,
      "/version_history.json",
    );
    if (versionHistoryContent) {
      const currentVersion = this._parseVersionHistory(versionHistoryContent);
      if (currentVersion) {
        const mcVersion = this._extractMcVersion(currentVersion);
        if (mcVersion) {
          logger.debug(
            `サーバー ${serverId} の MC バージョン: ${mcVersion} (version_history.json)`,
          );
          return mcVersion;
        }
      }
    }

    // 2. Pterodactyl の MINECRAFT_VERSION 起動変数を取得
    const pterodactylVersion = await this._getStartupVariable(
      serverId,
      "MINECRAFT_VERSION",
    );
    if (
      pterodactylVersion &&
      pterodactylVersion.trim() !== "" &&
      pterodactylVersion.toLowerCase() !== "latest"
    ) {
      logger.debug(
        `サーバー ${serverId} の MC バージョン: ${pterodactylVersion} (Pterodactyl起動変数)`,
      );
      return pterodactylVersion;
    }

    // 3. フォールバックバージョン（DBのmcVersion）
    if (fallbackVersion) {
      logger.debug(
        `サーバー ${serverId} の MC バージョン: ${fallbackVersion} (DB)`,
      );
      return fallbackVersion;
    }

    // 4. どれも取得できなかった
    logger.debug(`サーバー ${serverId} の MC バージョンを取得できませんでした`);
    return undefined;
  }
}

/** PterodactylStartupService のシングルトンインスタンス */
export const pterodactylStartupService = new PterodactylStartupService();
