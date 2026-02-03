import type { AutocompleteInteraction } from "discord.js";
import { serverBindingService } from "@/domain/services/ServerBindingService";
import { logger } from "@/utils/log";

/**
 * サーバーバインディングのオートコンプリートを実装する共通ヘルパー関数
 *
 * @param interaction オートコンプリートインタラクション
 */
export async function serverBindingAutocomplete(
  interaction: AutocompleteInteraction,
): Promise<void> {
  try {
    const focusedValue = interaction.options.getFocused().toString();

    // データベースからサーバー一覧を取得
    const servers = await serverBindingService.list();

    // 入力値でフィルタリング
    const filtered = servers
      .filter((server) =>
        server.name.toLowerCase().includes(focusedValue.toLowerCase()),
      )
      .slice(0, 25); // Discordの制限

    await interaction.respond(
      filtered.map((server) => ({
        name: server.name,
        value: server.name,
      })),
    );
  } catch (error) {
    logger.error("オートコンプリートエラー:", error);
    await interaction.respond([]);
  }
}
