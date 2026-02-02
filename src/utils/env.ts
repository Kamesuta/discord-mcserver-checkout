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
  /** PterodactylのClient APIキー */
  PTERODACTYL_CLIENT_API_KEY: str(),
  /** PterodactylのApplication APIキー */
  PTERODACTYL_APP_API_KEY: str(),
  /** 追加のヘッダー (JSON形式: { "Header-Key": "Header-Value" }) */
  PTERODACTYL_HEADERS: json<{ [key: string]: string }>({ default: {} }),

  /** パネル権限付与対象ユーザーに付与するDiscordロールID */
  DISCORD_PANEL_USER_ROLE_ID: str(),
  /** rcloneの保存先ベースパス (例: gdrive:/path/to/dir) */
  RCLONE_BASE_PATH: str(),
  /** 管理者通知用チャンネルID */
  DISCORD_ADMIN_CHANNEL_ID: str(),
  // biome-ignore-end lint/style/useNamingConvention: 環境変数の定義のため大文字使用
});

export default env;
