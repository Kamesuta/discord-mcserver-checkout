import "dotenv/config";
import { cleanEnv, str } from "envalid";

const env = cleanEnv(process.env, {
  /* eslint-disable @typescript-eslint/naming-convention */
  /** Discordトークン */
  DISCORD_TOKEN: str(),
  /** BOTが動くサーバーのID */
  GUILD_ID: str(),
  /* eslint-enable @typescript-eslint/naming-convention */
});

export default env;
