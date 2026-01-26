import "dotenv/config";
import { cleanEnv, str } from "envalid";

const env = cleanEnv(process.env, {
  // biome-ignore-start lint/style/useNamingConvention: 環境変数の定義のため大文字使用
  /** Discordトークン */
  DISCORD_TOKEN: str(),
  /** BOTが動くサーバーのID */
  GUILD_ID: str(),
  // biome-ignore-end lint/style/useNamingConvention: 環境変数の定義のため大文字使用
});

export default env;
