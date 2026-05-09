import type { SapphireClient } from "@sapphire/framework";
import type { ButtonInteraction, Message } from "discord.js";
import env from "@/utils/env";
import { logger } from "@/utils/log";

/**
 * 貸出期限リマインド通知メッセージを管理するサービス
 */
class ReminderMessageService {
  /** リマインド通知メッセージの本文に含まれる目印 */
  private readonly _REMINDER_MARKER =
    "【リマインド】サーバー貸出期限のお知らせ";

  /** リマインド通知Embedのタイトルに含まれる目印 */
  private readonly _REMINDER_TITLE_MARKER = "貸出期限のお知らせ";

  /**
   * ボタンが押されたリマインド通知メッセージを削除する
   * @param interaction ボタンインタラクション
   */
  public async deleteInteractionMessage(
    interaction: ButtonInteraction,
  ): Promise<void> {
    try {
      await interaction.message.delete();
      logger.debug(
        `リマインド通知メッセージを削除しました: ${interaction.message.id}`,
      );
    } catch (error) {
      // すでに消えている・権限がないなどの場合でも本処理は続行する
      logger.warn("リマインド通知メッセージの削除に失敗しました:", error);
    }
  }

  /**
   * 通知チャンネルから対象ワークフローのリマインド通知を削除する
   * @param client Sapphireクライアント
   * @param workflowId ワークフローID
   */
  public async deleteByWorkflowId(
    client: SapphireClient,
    workflowId: number,
  ): Promise<void> {
    try {
      const channel = await client.channels.fetch(
        env.DISCORD_NOTIFY_CHANNEL_ID,
      );
      if (!channel?.isSendable() || !("messages" in channel)) {
        logger.warn(
          "通知チャンネルが見つからないか、メッセージ取得できないチャンネルです。",
        );
        return;
      }

      const messages = await channel.messages.fetch({ limit: 100 });
      for (const [, message] of messages) {
        if (!this._isReminderMessage(message, client, workflowId)) {
          continue;
        }

        try {
          await message.delete();
          logger.debug(`リマインド通知メッセージを削除しました: ${message.id}`);
        } catch (error) {
          logger.warn("リマインド通知メッセージの削除に失敗しました:", error);
        }
      }
    } catch (error) {
      logger.error(
        "リマインド通知メッセージの検索中にエラーが発生しました:",
        error,
      );
    }
  }

  /**
   * 延長完了メッセージを通知チャンネルへ送信する
   * @param client Sapphireクライアント
   * @param workflow 延長したワークフロー
   * @param oldEndDate 延長前の期限
   * @param newEndDate 延長後の期限
   * @param actorDiscordId 実行者のDiscord ID
   * @param serverName サーバー名
   */
  public async sendExtensionNotification(
    client: SapphireClient,
    workflow: {
      id: number;
      name: string;
      organizerDiscordId: string;
      pteroServerId: string | null;
    },
    oldEndDate: Date,
    newEndDate: Date,
    actorDiscordId: string,
    serverName: string | null | undefined,
  ): Promise<void> {
    try {
      const channel = await client.channels.fetch(
        env.DISCORD_NOTIFY_CHANNEL_ID,
      );
      if (!channel?.isSendable()) {
        logger.warn("通知チャンネルが見つからないか、送信できません。");
        return;
      }

      const oldTimestamp = Math.floor(oldEndDate.getTime() / 1000);
      const newTimestamp = Math.floor(newEndDate.getTime() / 1000);
      const serverText = serverName ?? workflow.pteroServerId ?? "未割り当て";

      await channel.send({
        content:
          `<@${actorDiscordId}>が「${workflow.name}」(ID:${workflow.id},鯖:${serverText},主催:<@${workflow.organizerDiscordId}>)のサーバー貸出を${env.CHECKOUT_EXTEND_DAYS}日延長しました。\n` +
          `変更前:<t:${oldTimestamp}:D> → 変更後:<t:${newTimestamp}:D>`,
        allowedMentions: {
          // 実行者・主催者をメンション通知しない
          parse: [],
        },
      });
    } catch (error) {
      logger.error("延長通知の送信に失敗しました:", error);
    }
  }

  /**
   * 対象ワークフローのリマインド通知かどうかを判定する
   */
  private _isReminderMessage(
    message: Message,
    client: SapphireClient,
    workflowId: number,
  ): boolean {
    // BOT自身が送ったリマインド通知だけを削除対象にする
    if (message.author.id !== client.user?.id) {
      return false;
    }

    const hasReminderMarker =
      message.content.includes(this._REMINDER_MARKER) ||
      message.embeds.some((embed) =>
        embed.title?.includes(this._REMINDER_TITLE_MARKER),
      );
    if (!hasReminderMarker) {
      return false;
    }

    return message.embeds.some((embed) =>
      embed.fields.some(
        (field) =>
          field.name === "申請ID" && field.value === String(workflowId),
      ),
    );
  }
}

export const reminderMessageService = new ReminderMessageService();
