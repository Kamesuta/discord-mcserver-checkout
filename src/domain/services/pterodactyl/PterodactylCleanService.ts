import { pterodactylService } from "@/domain/services/pterodactyl/PterodactylService";
import { pterodactylStartupService } from "@/domain/services/pterodactyl/PterodactylStartupService";
import { logger } from "@/utils/log";
import {
  type PendingOperation,
  PterodactylBaseService,
} from "./PterodactylBaseService.js";

/**
 * Pterodactyl API のファイル一覧レスポンス型
 */
interface ListFilesResponse {
  data: {
    // biome-ignore-start lint/style/useNamingConvention: Pterodactyl API schema
    attributes: {
      /** ファイル名 */
      name: string;
      /** ディレクトリかどうか */
      is_dir: boolean;
    };
    // biome-ignore-end lint/style/useNamingConvention: Pterodactyl API schema
  }[];
}

/**
 * Pterodactyl API のサーバー詳細レスポンス型（再インストール確認用）
 */
interface PterodactylServerDetails {
  // biome-ignore-start lint/style/useNamingConvention: Pterodactyl API schema
  attributes: {
    /** サーバーがインストール中かどうか */
    is_installing: boolean;
  };
  // biome-ignore-end lint/style/useNamingConvention: Pterodactyl API schema
}

/**
 * Pterodactyl のサーバークリーン操作を管理するサービスクラス
 */
class PterodactylCleanService extends PterodactylBaseService {
  /** ポーリング間隔 (ms) */
  private static readonly _POLL_INTERVAL = 2000;
  /** 再インストールのタイムアウト (ms) */
  private static readonly _REINSTALL_POLL_TIMEOUT = 300000;

  /**
   * 全ファイル削除のみに行う（再インストールなし）
   * 返却時のリセットに使用
   * @param serverId サーバーID
   */
  public async reset(serverId: string): Promise<void> {
    await this._deleteAllFiles(serverId);
  }

  /**
   * サーバーを停止・全ファイル削除・バージョン設定・再インストールを順次実行する
   * reinstall 前にディレクトリが空であることを確認する
   * 貸出時の初期化に使用
   * @param serverId サーバーID
   * @param mcVersion リセットするMCバージョン
   * @throws ディレクトリが空でない場合にエラー
   */
  public async reinstall(serverId: string, mcVersion: string): Promise<void> {
    // ディレクトリが空であることを確認（Egg が server.properties だけ自動生成するため無視）
    const files = await this._getRootFiles(serverId);
    const unexpected = files.filter((name) => name !== "server.properties");
    if (unexpected.length > 0) {
      throw new Error(
        `サーバーディレクトリが空ではありません: ${unexpected.join(", ")}`,
      );
    }

    // サーバーを停止
    const stopResult = await pterodactylService.setPowerState(serverId, "stop");
    await stopResult.wait();

    // 全ファイルを削除
    await this._deleteAllFiles(serverId);

    // Docker イメージを決定
    const dockerImage =
      pterodactylStartupService.getJavaImageForMinecraftVersion(mcVersion);

    // MC バージョンのスタートアップ変数を設定
    await pterodactylStartupService.setStartupVariable(
      serverId,
      "MINECRAFT_VERSION",
      mcVersion,
    );

    // Docker イメージを設定
    await pterodactylStartupService.setDockerImage(serverId, dockerImage);

    // サーバーを再インストール
    const reinstallResult = await this._reinstallServer(serverId);
    await reinstallResult.wait();
  }

  /**
   * ルートディレクトリのファイル名一覧を取得する
   * @param serverId サーバーID
   * @returns ファイル名のリスト
   */
  private async _getRootFiles(serverId: string): Promise<string[]> {
    const data = await this._requestClientApi<ListFilesResponse>(
      `/servers/${serverId}/files/list`,
    );
    return data.data.map((file) => file.attributes.name);
  }

  /**
   * サーバーのルートディレクトリ直下の全ファイルを削除する
   * @param serverId サーバーID
   */
  private async _deleteAllFiles(serverId: string): Promise<void> {
    try {
      const files = await this._getRootFiles(serverId);
      // ファイルが空の場合は何もしない
      if (files.length === 0) return;

      // ルートディレクトリ直下ファイルを削除
      await this._requestClientApi(`/servers/${serverId}/files/delete`, {
        method: "POST",
        body: JSON.stringify({ root: "/", files }),
      });
    } catch (error) {
      logger.error(
        `サーバー ${serverId} のファイル削除中にエラーが発生しました:`,
        error,
      );
      throw error;
    }
  }

  /**
   * サーバーを再インストール（初期化）する
   * @param serverId サーバーID
   * @returns completion を await すると再インストール完了まで待機する
   */
  private async _reinstallServer(
    serverId: string,
  ): Promise<PendingOperation<void, void>> {
    try {
      await this._requestClientApi(`/servers/${serverId}/settings/reinstall`, {
        method: "POST",
      });
    } catch (error) {
      logger.error(
        `サーバー ${serverId} の再インストール中にエラーが発生しました:`,
        error,
      );
      throw error;
    }

    let completion: Promise<void> | undefined;

    return {
      response: undefined,
      wait: () => {
        if (completion) return completion;

        completion = this._pollUntil(
          async () => {
            const data = await this._requestClientApi<PterodactylServerDetails>(
              `/servers/${serverId}`,
            );
            return data.attributes.is_installing;
          },
          (isInstalling) => !isInstalling,
          PterodactylCleanService._POLL_INTERVAL,
          PterodactylCleanService._REINSTALL_POLL_TIMEOUT,
          `サーバー ${serverId} の再インストールがタイムアウトしました`,
        ).then(() => {});

        return completion;
      },
    };
  }
}

/** PterodactylCleanService のシングルトンインスタンス */
export const pterodactylCleanService = new PterodactylCleanService();
