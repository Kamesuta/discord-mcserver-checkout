import type { Client, TextChannel } from "discord.js";
import env from "@/utils/env";
import { logger } from "@/utils/log";

/**
 * 新規の仮ユーザーが追加されたときに通知チャンネルに管理者へ通知する
 * @param client Discord Client
 * @param newPanelUsers 新規作成された仮ユーザーの Discord ID リスト
 */
export async function notifyNewPanelUsers(
  client: Client,
  newPanelUsers: string[],
): Promise<void> {
  if (newPanelUsers.length === 0) return;

  try {
    const channel = await client.channels.fetch(env.DISCORD_NOTIFY_CHANNEL_ID);
    if (channel?.isSendable()) {
      const mentions = newPanelUsers.map((id) => `<@${id}>`).join(", ");
      await channel.send(
        `<@&${env.DISCORD_ADMIN_ROLE_ID}>\n` +
          `以下のユーザーがパネルユーザーとして追加されました。\n` +
          `\`/mcserver-op user register\` で Pterodactyl ユーザーとして登録してください: ${mentions}`,
      );
    }
  } catch (error) {
    logger.error("新規パネルユーザー通知に失敗しました:", error);
  }
}
