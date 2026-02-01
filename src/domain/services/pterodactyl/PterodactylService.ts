import semver from "semver";
import { logger } from "../../../utils/log.js";
import {
  type PendingOperation,
  PterodactylBaseService,
} from "./PterodactylBaseService.js";

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

interface PterodactylServerDetails {
  // biome-ignore-start lint/style/useNamingConvention: Pterodactyl API schema
  attributes: {
    /** サーバーがインストール中かどうか */
    is_installing: boolean;
  };
  // biome-ignore-end lint/style/useNamingConvention: Pterodactyl API schema
}

/**
 * Pterodactyl のサーバー操作を管理するサービスクラス
 */
class PterodactylService extends PterodactylBaseService {
  /** 電源操作のポーリング間隔 (ms) */
  private static readonly _POWER_POLL_INTERVAL = 2000;
  /** 電源操作のタイムアウト (ms) */
  private static readonly _POWER_POLL_TIMEOUT = 60000;
  /** 再インストールのタイムアウト (ms) */
  private static readonly _REINSTALL_POLL_TIMEOUT = 300000;

  /**
   * サーバーのステータスを取得
   * @param serverId サーバーID
   * @returns サーバーの現在の状態 (running, offline など)
   */
  public async getServerStatus(serverId: string): Promise<string> {
    try {
      const data = await this._requestClientApi<PterodactylServerResources>(
        `/servers/${serverId}/resources`,
      );
      return data.attributes.current_state;
    } catch (error) {
      logger.error("サーバーステータスの取得中にエラーが発生しました:", error);
      throw error;
    }
  }

  /**
   * サーバーの電源状態を変更し、完了待機用の PendingOperation を返す
   * @param serverId サーバーID
   * @param signal 電源操作シグナル (start/stop/restart/kill)
   * @returns completion を await すると操作完了まで待機する。await しなくても unhandled rejection にならない
   */
  public async setPowerState(
    serverId: string,
    signal: "start" | "stop" | "restart" | "kill",
  ): Promise<PendingOperation<void, void>> {
    try {
      await this._requestClientApi(`/servers/${serverId}/power`, {
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

    let completion: Promise<void> | undefined;

    return {
      response: undefined,
      wait: () => {
        if (completion) return completion;

        // restart: 完了後の状態が観測しづらいため、即時完了とする
        if (signal === "restart") {
          completion = Promise.resolve();
          return completion;
        }

        // start→running, stop/kill→offline になるまで待機
        const expectedState = signal === "start" ? "running" : "offline";
        completion = this._pollUntil(
          () => this.getServerStatus(serverId),
          (state) => state === expectedState,
          PterodactylService._POWER_POLL_INTERVAL,
          PterodactylService._POWER_POLL_TIMEOUT,
          `サーバー ${serverId} の電源操作（${signal}）がタイムアウトしました`,
        ).then(() => {});

        return completion;
      },
    };
  }

  /**
   * サーバーを再インストール（初期化）する
   * @param serverId サーバーID
   * @returns completion を await すると再インストール完了まで待機する
   */
  public async reinstallServer(
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
          PterodactylService._POWER_POLL_INTERVAL,
          PterodactylService._REINSTALL_POLL_TIMEOUT,
          `サーバー ${serverId} の再インストールがタイムアウトしました`,
        ).then(() => {});

        return completion;
      },
    };
  }

  /**
   * サーバーのファイルを削除
   * @param serverId サーバーID
   */
  public async deleteAllFiles(serverId: string): Promise<void> {
    try {
      // サーバーのルートディレクトリ内のファイル一覧を取得
      const data = await this._requestClientApi<ListFilesResponse>(
        `/servers/${serverId}/files/list`,
      );
      const files = data.data.map((file) => file.attributes.name);

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
   * サーバーのスタートアップ変数を設定
   * @param serverId サーバーID
   * @param key 変数名
   * @param value 設定する値
   */
  public async setStartupVariable(
    serverId: string,
    key: string,
    value: string,
  ): Promise<void> {
    try {
      await this._requestClientApi(`/servers/${serverId}/startup/variable`, {
        method: "PUT",
        body: JSON.stringify({ key, value }),
      });
    } catch (error) {
      logger.error(
        `サーバー ${serverId} のスタートアップ変数設定中にエラーが発生しました:`,
        error,
      );
      throw error;
    }
  }

  /**
   * サーバーの Docker イメージを設定
   * @param serverId サーバーID
   * @param image イメージ名
   */
  public async setDockerImage(serverId: string, image: string): Promise<void> {
    try {
      await this._requestClientApi(
        `/servers/${serverId}/settings/docker-image`,
        {
          method: "PUT",
          body: JSON.stringify({
            // biome-ignore-start lint/style/useNamingConvention: Pterodactyl API schema
            docker_image: image,
            // biome-ignore-end lint/style/useNamingConvention: Pterodactyl API schema
          }),
        },
      );
    } catch (error) {
      logger.error(
        `サーバー ${serverId} の Docker イメージ設定中にエラーが発生しました:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Minecraft バージョンに基づいて最適な Java Docker イメージを決定する
   * @param mcVersion Minecraft バージョン (例: 1.20.1)
   * @returns Docker イメージ名
   */
  public getJavaImageForMinecraftVersion(mcVersion: string): string {
    const v = semver.coerce(mcVersion);
    if (!v) {
      // 判定できない場合は最新の Java 21 を返す
      return "ghcr.io/pterodactyl/yolks:java_21";
    }

    if (semver.satisfies(v, ">=1.20.5"))
      return "ghcr.io/pterodactyl/yolks:java_21";
    if (semver.satisfies(v, ">=1.18.0"))
      return "ghcr.io/pterodactyl/yolks:java_17";
    if (semver.satisfies(v, ">=1.17.0"))
      return "ghcr.io/pterodactyl/yolks:java_16";
    return "ghcr.io/pterodactyl/yolks:java_8";
  }
}

/** PterodactylService のシングルトンインスタンス */
export const pterodactylService = new PterodactylService();
