import "dotenv/config";
import { cleanEnv, json, str } from "envalid";

const env = cleanEnv(process.env, {
  // biome-ignore-start lint/style/useNamingConvention: 環境変数の定義のため大文字使用
  /** Discordトークン */
  DISCORD_TOKEN: str(),
  /** BOTが動くサーバーのID */
  GUILD_ID: str(),

  /** PterodactylのベースURL (例: https://panel.example.com) */
  PTERODACTYL_BASE_URL: str(),
  /** PterodactylのAPIキー */
  PTERODACTYL_API_KEY: str(),
  /** 追加のヘッダー (JSON形式: { "Header-Key": "Header-Value" }) */
  PTERODACTYL_HEADERS: json<{ [key: string]: string }>({ default: {} }),
  // biome-ignore-end lint/style/useNamingConvention: 環境変数の定義のため大文字使用
});

export default env;
