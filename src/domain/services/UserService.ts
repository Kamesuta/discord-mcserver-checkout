import type { Guild } from "discord.js";
import { pterodactylUserService } from "@/domain/services/pterodactyl/PterodactylUserService";
import type { PterodactylUser } from "@/generated/prisma/client";
import env from "@/utils/env";
import { logger } from "@/utils/log";
import { prisma } from "@/utils/prisma";

/**
 * ユーザー管理サービス
 * Pterodactyl APIとDBの両方を扱う
 */
class UserService {
  /**
   * Discord IDからPterodactylユーザー情報を取得
   * @param discordId Discord ID
   * @returns Pterodactylユーザー情報 (存在しない場合はnull)
   */
  public async findByDiscordId(
    discordId: string,
  ): Promise<PterodactylUser | null> {
    return await prisma.pterodactylUser.findUnique({
      where: { discordId },
    });
  }

  /**
   * Discord IDのリストからPterodactylユーザー情報を取得
   * @param discordIds Discord IDのリスト
   * @returns Pterodactylユーザー情報のリスト
   */
  public async findByDiscordIds(
    discordIds: string[],
  ): Promise<PterodactylUser[]> {
    return await prisma.pterodactylUser.findMany({
      where: { discordId: { in: discordIds } },
    });
  }

  /**
   * PterodactylにユーザーIDを登録し、DBにも保存し、Discordロールを付与
   * @param username ニックネーム (半角英数)
   * @param discordId Discord ID
   * @param guild Discord Guild（ロール付与に使用、nullの場合はスキップ）
   */
  public async registerUser(
    username: string,
    discordId: string,
    guild: Guild | null = null,
  ): Promise<void> {
    try {
      const email = `${username}@kpw.local`;

      // Pterodactylに登録
      await pterodactylUserService.registerUser(username, email);

      // DBに保存（registered=true）
      await prisma.pterodactylUser.upsert({
        where: { discordId },
        update: {
          username,
          email,
          registered: true,
        },
        create: {
          discordId,
          username,
          email,
          registered: true,
        },
      });

      // Discord ロール付与（未付与の場合のみ）
      if (guild) {
        const member = await guild.members.fetch(discordId);
        if (!member.roles.cache.has(env.DISCORD_PANEL_USER_ROLE_ID)) {
          await member.roles.add(env.DISCORD_PANEL_USER_ROLE_ID);
        }
      }
    } catch (error) {
      logger.error(
        `ユーザー ${username} (Discord ID: ${discordId}) の登録中にエラーが発生しました:`,
        error,
      );
      throw error;
    }
  }

  /**
   * ユーザーのパスワードをリセット
   * @param discordId Discord ID
   * @returns 新しいパスワード
   */
  public async resetPassword(discordId: string): Promise<string> {
    const user = await this.findByDiscordId(discordId);
    if (!user || !user.registered || !user.email) {
      throw new Error(
        "Pterodactyl ユーザーが登録されていません。管理者に連絡してください。",
      );
    }
    return await pterodactylUserService.resetPassword(user.email);
  }

  /**
   * サーバーにユーザーを追加
   * @param serverId サーバーID
   * @param discordId Discord ID
   */
  public async addUserToServer(
    serverId: string,
    discordId: string,
  ): Promise<void> {
    const user = await this.findByDiscordId(discordId);
    if (!user || !user.registered || !user.email) {
      throw new Error("ユーザーが見つかりませんでした");
    }
    await pterodactylUserService.addUser(serverId, user.email);
  }

  /**
   * サーバーからユーザーを削除
   * @param serverId サーバーID
   * @param discordId Discord ID
   */
  public async removeUserFromServer(
    serverId: string,
    discordId: string,
  ): Promise<void> {
    const user = await this.findByDiscordId(discordId);
    if (!user || !user.registered || !user.email) {
      throw new Error("ユーザーが見つかりませんでした");
    }
    await pterodactylUserService.removeUser(serverId, user.email);
  }
}

/** UserService のシングルトンインスタンス */
export const userService = new UserService();
