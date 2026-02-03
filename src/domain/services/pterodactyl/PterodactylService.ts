import { logger } from "@/utils/log";
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
 * Pterodactyl のサーバー操作を管理するサービスクラス
 */
class PterodactylService extends PterodactylBaseService {
  /** 電源操作のポーリング間隔 (ms) */
  private static readonly _POWER_POLL_INTERVAL = 2000;
  /** 電源操作のタイムアウト (ms) */
  private static readonly _POWER_POLL_TIMEOUT = 60000;

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
}

/** PterodactylService のシングルトンインスタンス */
export const pterodactylService = new PterodactylService();
