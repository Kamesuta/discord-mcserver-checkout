import {
  ApplicationCommandRegistries,
  LogLevel,
  RegisterBehavior,
  SapphireClient,
} from "@sapphire/framework";
import { GatewayIntentBits } from "discord.js";
import { sapphireLogger } from "./utils/log.js";
import env from "./utils/env.js";

// このBOTはGUILD_IDのサーバーのみで動作する (他鯖で動作させない)
ApplicationCommandRegistries.setDefaultGuildIds([env.GUILD_ID]);
// このBotが登録しているコマンドを全置き換えする
ApplicationCommandRegistries.setDefaultBehaviorWhenNotIdentical(
  RegisterBehavior.BulkOverwrite,
);

// Sapphireクライアントの初期化
const client = new SapphireClient({
  logger: {
    level: LogLevel.Debug,
    instance: sapphireLogger,
  },
  shards: "auto",
  intents: [GatewayIntentBits.GuildMessages, GatewayIntentBits.Guilds],
  loadMessageCommandListeners: true,
});

// ログイン
try {
  client.logger.info("Logging in");
  await client.login();
  client.logger.info(`Logged in as ${client.user?.tag ?? "Unknown"}`);
} catch (error) {
  client.logger.fatal(error);
  await client.destroy();
  process.exit(1);
}
