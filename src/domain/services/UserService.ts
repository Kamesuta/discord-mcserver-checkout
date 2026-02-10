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
   * @param username Pterodactyl用ID (半角英数)
   * @param nickname ニックネーム（表示名）
   * @param discordId Discord ID
   * @param guild Discord Guild（ロール付与に使用、nullの場合はスキップ）
   */
  public async registerUser(
    username: string,
    nickname: string,
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
          nickname,
          email,
          registered: true,
        },
        create: {
          discordId,
          username,
          nickname,
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
   * サーバーのサブユーザーをpanelUsersと同期
   * - panelUsersに含まれるユーザーを全員追加
   * - panelUsersに含まれないユーザーを削除（user.*権限を持つ管理者は除く）
   * @param serverId サーバーID
   * @param discordIds panelUsersのDiscord IDリスト
   */
  public async ensureServerUsers(
    serverId: string,
    discordIds: string[],
  ): Promise<void> {
    try {
      // 1. 現在のサブユーザー一覧を取得
      const currentUsers = await pterodactylUserService.listUsers(serverId);

      // 2. panelUsersのメールアドレスを取得
      const panelUsers = await this.findByDiscordIds(discordIds);
      const registeredPanelUsers = panelUsers.filter(
        (u): u is typeof u & { email: string } => u.registered && !!u.email,
      );
      const panelEmails = new Set(
        registeredPanelUsers.map((u) => u.email.toLowerCase()),
      );

      // 3. 追加すべきユーザーと削除すべきユーザーを判定
      const currentEmails = new Set(
        currentUsers.data.map((u) => u.attributes.email.toLowerCase()),
      );

      // 追加すべきユーザー（panelEmailsにあるが、currentEmailsにない）
      const toAdd = registeredPanelUsers.filter(
        (u) => !currentEmails.has(u.email.toLowerCase()),
      );

      // 削除すべきユーザー（currentEmailsにあるが、panelEmailsにない）
      // ただし、user.*権限を持つ管理者は除外
      const toRemove = currentUsers.data.filter((u) => {
        const email = u.attributes.email.toLowerCase();
        if (panelEmails.has(email)) return false; // panelUsersは削除しない

        // user.*権限を持つ管理者は削除しない
        const hasAdminPermission = u.attributes.permissions.some((p) =>
          p.startsWith("user."),
        );
        return !hasAdminPermission;
      });

      // 4. ユーザーを追加
      for (const user of toAdd) {
        try {
          await pterodactylUserService.addUser(serverId, user.email);
          logger.info(
            `サーバー ${serverId} にユーザー ${user.email} を追加しました`,
          );
        } catch (error) {
          logger.error(`ユーザー ${user.email} の追加に失敗:`, error);
          // 継続
        }
      }

      // 5. ユーザーを削除
      for (const user of toRemove) {
        try {
          await pterodactylUserService.removeUser(
            serverId,
            user.attributes.email,
          );
          logger.info(
            `サーバー ${serverId} からユーザー ${user.attributes.email} を削除しました`,
          );
        } catch (error) {
          logger.error(
            `ユーザー ${user.attributes.email} の削除に失敗:`,
            error,
          );
          // 継続
        }
      }
    } catch (error) {
      logger.error(`サーバー ${serverId} のユーザー同期に失敗:`, error);
      throw error;
    }
  }
}

/** UserService のシングルトンインスタンス */
export const userService = new UserService();
