import env from "../../../utils/env.js";
import { logger } from "../../../utils/log.js";

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
}
