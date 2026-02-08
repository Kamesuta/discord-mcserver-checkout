import type { SapphireClient } from "@sapphire/framework";
import type { APIMessageTopLevelComponent, JSONEncodable } from "discord.js";
import {
  ComponentType,
  ContainerBuilder,
  type Message,
  MessageFlags,
  SectionBuilder,
  type SendableChannels,
  TextDisplayBuilder,
} from "discord.js";
import { GanttChart } from "@/discord-utils/GanttChart";
import { serverBindingService } from "@/domain/services/ServerBindingService";
import { workflowService } from "@/domain/services/WorkflowService";
import { WorkflowStatus } from "@/generated/prisma/client";
import { CheckoutRequestButton } from "@/interaction-handlers/notification/CheckoutRequestButton";
import { ReturnRequestButton } from "@/interaction-handlers/notification/ReturnRequestButton";
import env from "@/utils/env";
import { logger } from "@/utils/log";

/**
 * 通知チャンネルの全部確認ボードを管理するサービス
 */
class NotificationBoardService {
  /** ボードメッセージを識別するタイトル */
  private readonly _BOARD_TITLE = "鯖申請確認ボード";

  /**
   * ボードを作成または更新
   * 1. 最後のメッセージが確認ボードの場合は編集
   * 2. それ以外の場合は新規投稿してから古いボードを削除
   */
  async updateBoard(client: SapphireClient): Promise<void> {
    try {
      // 通知チャンネルを取得
      const channel = await client.channels.fetch(
        env.DISCORD_NOTIFY_CHANNEL_ID,
      );

      if (!channel?.isSendable()) {
        logger.warn(
          "通知チャンネルが見つからないか、テキストチャンネルではありません。",
        );
        return;
      }

      // ボードの表示内容を生成
      const content = await this._buildBoardContent();

      // 既存のボードメッセージを検索し、古いものを削除
      const existingBoard = await this._findOrCleanBoardMessages(
        channel,
        client,
      );

      if (existingBoard) {
        // 最後のメッセージがボードの場合は編集
        await existingBoard.edit(content);
        logger.debug("既存の確認ボードを編集しました。");
      } else {
        // 新しいボードメッセージを投稿
        await channel.send(content);
        logger.debug("新しい確認ボードを作成しました。");
      }
    } catch (error) {
      logger.error("ボード更新中にエラーが発生しました:", error);
    }
  }

  /**
   * ボードの表示内容を生成
   */
  private async _buildBoardContent(): Promise<{
    components: JSONEncodable<APIMessageTopLevelComponent>[];
    flags: number;
  }> {
    const components: JSONEncodable<APIMessageTopLevelComponent>[] = [];

    // タイトル
    components.push(
      new TextDisplayBuilder().setContent(`# ${this._BOARD_TITLE}`),
    );

    // PENDING申請セクション
    const pendingText = await this._buildPendingSection();
    components.push(
      new ContainerBuilder()
        .setAccentColor(0xff0000)
        .addSectionComponents(
          new SectionBuilder()
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(pendingText),
            )
            .setButtonAccessory(CheckoutRequestButton.build()),
        ),
    );

    // ACTIVE申請セクションとガントチャート
    const { section: activeText, ganttChart } =
      await this._buildActiveSection();
    components.push(
      new ContainerBuilder()
        .setAccentColor(0x3498db)
        .addSectionComponents(
          new SectionBuilder()
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(activeText),
            )
            .setButtonAccessory(ReturnRequestButton.build()),
        )
        .addTextDisplayComponents(
          // ガントチャートがある場合は追加
          ...(ganttChart
            ? [new TextDisplayBuilder().setContent(ganttChart)]
            : []),
        ),
    );

    return {
      components,
      flags: MessageFlags.IsComponentsV2 | MessageFlags.SuppressNotifications, // 通知を抑制
    };
  }

  /**
   * PENDING申請セクションを生成
   */
  private async _buildPendingSection(): Promise<string> {
    const workflows = await workflowService.findByStatus(
      WorkflowStatus.PENDING,
    );

    let section = `## 承認待ちの申請 (${workflows.length}件)\n`;
    if (workflows.length === 0) {
      section += "現在ありません。";
    } else {
      workflows.slice(0, 10).forEach((wf) => {
        // パネルユーザーが主催者と同じ場合は表示しない
        const isOrganizerOnly =
          wf.panelUsers.length === 1 &&
          wf.panelUsers[0].discordId === wf.organizerDiscordId;
        const panelUserText = isOrganizerOnly
          ? ""
          : ` パネル: ${wf.panelUsers.map((u) => `<@${u.discordId}>`).join(", ")}`;

        // 申請者が主催者と違う場合表示
        const applicantText =
          wf.applicantDiscordId === wf.organizerDiscordId
            ? ""
            : ` (申請者: <@${wf.applicantDiscordId}>)`;

        section += `- ID:${wf.id} — ${wf.name}\n`;
        section += `  主催: <@${wf.organizerDiscordId}>${applicantText}${panelUserText}\n`;
        section += `  期間: ${wf.periodDays}日, バージョン: ${wf.mcVersion ?? "未指定"}\n`;
      });

      if (workflows.length > 10) {
        section += `\n...他${workflows.length - 10}件`;
      }
    }

    return section;
  }

  /**
   * ACTIVE申請セクションとガントチャートを生成
   */
  private async _buildActiveSection(): Promise<{
    section: string;
    ganttChart: string | undefined;
  }> {
    const workflows = await workflowService.findByStatus(WorkflowStatus.ACTIVE);

    let section = `## 貸出中サーバー (${workflows.length}件)\n`;
    if (workflows.length === 0) {
      section += "現在ありません。";
      return { section, ganttChart: undefined };
    }

    // ガントチャートの表示期間を設定（過去3日〜未来10日）
    const today = new Date();
    const startRange = new Date(today);
    startRange.setDate(startRange.getDate() - 3);
    const endRange = new Date(today);
    endRange.setDate(endRange.getDate() + 10);

    const ganttChart = new GanttChart(startRange, endRange, today);
    let hasGanttData = false;

    for (const wf of workflows) {
      // サーバーのバインディング名を取得
      const serverName = wf.pteroServerId
        ? await serverBindingService.getName(wf.pteroServerId)
        : undefined;

      const endDateText = wf.endDate
        ? `<t:${Math.floor(wf.endDate.getTime() / 1000)}:R>`
        : "未設定";

      section += `- ${serverName ?? "未割当"}: ${endDateText}「${wf.name}」(ID:${wf.id},主催:<@${wf.organizerDiscordId}>)\n`;

      // ガントチャート用データを追加
      if (wf.startDate && wf.endDate && serverName) {
        ganttChart.addTask({
          id: wf.id.toString(),
          name: serverName,
          start: wf.startDate,
          end: wf.endDate,
        });
        hasGanttData = true;
      }
    }

    const ganttChartText = hasGanttData
      ? `\`\`\`\n${ganttChart.render()}\`\`\``
      : undefined;

    return { section, ganttChart: ganttChartText };
  }

  /**
   * メッセージがボードメッセージかどうかを判定
   */
  private _isBoardMessage(msg: Message, client: SapphireClient): boolean {
    // BOT自身のメッセージではない場合はfalse
    if (msg.author.id !== client.user?.id) {
      return false;
    }

    // Components V2フラグがあるかチェック
    if (!msg.flags.has(MessageFlags.IsComponentsV2)) {
      return false;
    }

    // 最初のコンポーネントがタイトル_BOARD_TITLEかチェック
    if (msg.components.length === 0) {
      return false;
    }

    const firstComponent = msg.components[0];
    // TextDisplayComponent かチェック
    if (firstComponent.type !== ComponentType.TextDisplay) {
      return false;
    }

    // content に _BOARD_TITLE が含まれているかチェック
    return firstComponent.content?.includes(this._BOARD_TITLE) ?? false;
  }

  /**
   * ボードメッセージを検索し、古いものを削除
   * 最後のメッセージがボードメッセージの場合はそれを返す
   * @param channel 通知チャンネル
   * @param client Sapphireクライアント
   * @returns 最後のメッセージがボードメッセージの場合はそれを返す、それ以外はundefined
   */
  private async _findOrCleanBoardMessages(
    channel: SendableChannels,
    client: SapphireClient,
  ): Promise<Message | undefined> {
    // TextChannel であることを確認（messages プロパティがあるか）
    if (!("messages" in channel)) {
      return undefined;
    }

    try {
      let messages = await channel.messages.fetch({ limit: 50 });
      const lastMessage = messages.first();
      let messageToEdit: Message | undefined;

      // 最後のメッセージがボードの場合
      if (lastMessage && this._isBoardMessage(lastMessage, client)) {
        // 他の古いボードメッセージを削除
        messages = messages.filter((msg) => msg.id !== lastMessage.id);
        messageToEdit = lastMessage;
      }

      // 古いボードメッセージを削除
      for (const [, msg] of messages) {
        if (this._isBoardMessage(msg, client)) {
          try {
            await msg.delete();
            logger.debug(`古いボードメッセージを削除しました: ${msg.id}`);
          } catch (error) {
            logger.error("ボードメッセージの削除に失敗:", error);
          }
        }
      }

      return messageToEdit;
    } catch (error) {
      logger.error("過去のメッセージ取得中にエラーが発生しました:", error);
      return undefined;
    }
  }
}

export const notificationBoardService = new NotificationBoardService();
