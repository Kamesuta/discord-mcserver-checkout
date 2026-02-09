import env from "@/utils/env";
import { logger } from "@/utils/log";

/**
 * Pterodactyl API のエラーレスポンス構造
 */
interface PterodactylApiError {
  errors: {
    code: string;
    status: string;
    detail: string;
  }[];
}

/**
 * 完了を待てる非同期操作の戻り値
 *
 * @template Immediate リクエスト送信直後に得る戻り値の型
 * @template Completed wait() で待機した際の完了結果の型
 *
 * `wait()` を呼ばなければポーリングは開始しない。
 * `wait()` は遅延で一度だけポーリングを開始し、以降は同じ Promise を返す。
 */
export interface PendingOperation<Immediate, Completed> {
  /** リクエスト送信直後の戻り値 */
  response: Immediate;
  /** 操作の完了を待つ。完了時の結果を返す */
  wait(): Promise<Completed>;
}

/**
 * Pterodactyl API との通信の共通処理を提供するベースサービスクラス
 * サーバー操作や機能固有のメソッドは、このクラスを継承した各サービスに配置する
 */
export class PterodactylBaseService {
  /** Pterodactyl API のベースURL */
  protected readonly _baseUrl: string = env.PTERODACTYL_BASE_URL;

  /** Pterodactyl Client API キー */
  protected readonly _apiKey: string = env.PTERODACTYL_CLIENT_API_KEY;

  /** Pterodactyl Application API キー */
  protected readonly _appApiKey: string = env.PTERODACTYL_APP_API_KEY;

  /** カスタムヘッダー (Cloudflare Access など) */
  protected readonly _customHeaders: Record<string, string> =
    env.PTERODACTYL_HEADERS;

  /**
   * Pterodactyl API への共通リクエスト処理
   * @param url リクエスト先の完全URL
   * @param apiKey 認証に使用するAPIキー
   * @param options fetch オプション
   * @returns パースされたレスポンス
   */
  private async _fetch<T>(
    url: string,
    apiKey: string,
    options: RequestInit = {},
  ): Promise<T> {
    const headers = {
      // biome-ignore-start lint/style/useNamingConvention: Pterodactyl API headers
      Authorization: `Bearer ${apiKey}`,
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

    if (!response.ok) {
      const body = await response.text();

      // Pterodactyl のエラーレスポンスを パースして code + detail を取り出す
      let errorMessage = `${response.status} ${response.statusText}`;
      try {
        const errorBody: PterodactylApiError = JSON.parse(body);
        if (errorBody.errors?.[0]) {
          const { code, detail } = errorBody.errors[0];
          errorMessage = `${code}: ${detail}`;
        }
      } catch {
        // JSON でない場合はステータス行のみ使用
      }

      logger.error(`Pterodactyl API エラー [${url}]: ${errorMessage}`);
      throw new Error(`Pterodactyl API エラー: ${errorMessage}`);
    }

    if (response.status === 204) {
      return {} as T;
    }

    return response.json();
  }

  /**
   * Pterodactyl Client API にリクエストを送信する
   * @param endpoint API エンドポイント (/api/client からの相対パス)
   * @param options fetch オプション
   * @returns API レスポンス
   */
  protected async _requestClientApi<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<T> {
    return this._fetch<T>(
      `${this._baseUrl}/api/client${endpoint}`,
      this._apiKey,
      options,
    );
  }

  /**
   * Pterodactyl Application API にリクエストを送信する
   * @param endpoint API エンドポイント (/api/application からの相対パス)
   * @param options fetch オプション
   * @returns API レスポンス
   */
  protected async _requestAppApi<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<T> {
    return this._fetch<T>(
      `${this._baseUrl}/api/application${endpoint}`,
      this._appApiKey,
      options,
    );
  }

  /**
   * 条件を満たすまで定期的にポーリングする
   * @param pollFn ポーリング時に呼ぶ関数
   * @param isComplete 完了判定コールバック
   * @param intervalMs ポーリング間隔 (ms)
   * @param timeoutMs タイムアウト (ms)
   * @param timeoutMessage タイムアウト時のエラーメッセージ
   * @returns 完了判定が true になった時点の結果
   */
  protected async _pollUntil<T>(
    pollFn: () => Promise<T>,
    isComplete: (result: T) => boolean,
    intervalMs: number,
    timeoutMs: number,
    timeoutMessage: string,
  ): Promise<T> {
    const deadline = Date.now() + timeoutMs;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const result = await pollFn();
      if (isComplete(result)) return result;
      if (Date.now() >= deadline) {
        throw new Error(timeoutMessage);
      }
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }

  /**
   * サーバー上のファイル内容を読み取る
   * @param serverId サーバーID
   * @param filePath ファイルパス（ルートからの相対パス）
   * @returns ファイルの内容。読み取れない場合は undefined
   */
  protected async _readFileContent(
    serverId: string,
    filePath: string,
  ): Promise<string | undefined> {
    try {
      const response = await fetch(
        `${this._baseUrl}/api/client/servers/${serverId}/files/contents?file=${encodeURIComponent(filePath)}`,
        {
          headers: {
            // biome-ignore-start lint/style/useNamingConvention: Pterodactyl API headers
            Authorization: `Bearer ${this._apiKey}`,
            Accept: "text/plain",
            // biome-ignore-end lint/style/useNamingConvention: Pterodactyl API headers
            ...this._customHeaders,
          },
        },
      );

      if (!response.ok) {
        return undefined;
      }

      return await response.text();
    } catch (error) {
      logger.debug(
        `サーバー ${serverId} のファイル ${filePath} の読み取りに失敗しました:`,
        error,
      );
      return undefined;
    }
  }
}
