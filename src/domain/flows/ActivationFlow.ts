import {
  ActionRowBuilder,
  ButtonBuilder,
  type ButtonInteraction,
  ButtonStyle,
  EmbedBuilder,
  type ModalSubmitInteraction,
} from "discord.js";
import { commandMentions } from "@/discord-utils/commands.js";
import { ProgressTracker } from "@/discord-utils/ProgressTracker";
import { notificationBoardService } from "@/domain/services/NotificationBoardService";
import { pterodactylCleanService } from "@/domain/services/pterodactyl/PterodactylCleanService";
import { pterodactylService } from "@/domain/services/pterodactyl/PterodactylService";
import { serverBindingService } from "@/domain/services/ServerBindingService";
import { userService } from "@/domain/services/UserService";
import {
  type WorkflowWithUsers,
  workflowService,
} from "@/domain/services/WorkflowService";
import { workflowFields } from "@/domain/utils/workflowFields";
import { type ServerBinding, WorkflowStatus } from "@/generated/prisma/client";
import { WorkflowApproveButton } from "@/interaction-handlers/mcserver-op/WorkflowApproveButton";
import env from "@/utils/env";
import { logger } from "@/utils/log";

type ActivationInteraction = ButtonInteraction | ModalSubmitInteraction;

/**
 * サーバーの設定を更新（サブユーザー同期 + Description更新）
 * @param pteroServerId PterodactylサーバーID
 * @param organizerDiscordId 主催者のDiscord ID
 * @param workflowName 企画名
 * @param panelUserIds パネルユーザーのDiscord IDリスト
 */
export async function updateServerSettings(
  pteroServerId: string,
  organizerDiscordId: string,
  workflowName: string,
  panelUserIds: string[],
): Promise<void> {
  // サーバーのサブユーザーを同期
  await userService.ensureServerUsers(pteroServerId, panelUserIds);

  // サーバーのDescriptionを更新
  try {
    const organizerUser = await userService.findByDiscordId(organizerDiscordId);
    const organizerName = organizerUser?.nickname ?? organizerDiscordId;
    const description = `${organizerName} ${workflowName}`;
    await pterodactylService.updateServerDescription(
      pteroServerId,
      description,
    );
  } catch (error) {
    // Description更新失敗は無視（ログには記録される）
    logger.error("Failed to update server description:", error);
  }
}

/**
 * ワークフローをアクティブ化する共通処理
 * - サーバー割り当て
 * - パネルユーザー追加
 * - サーバーリセット（オプション）
 * - 通知
 * @param interaction インタラクション（deferReply済み）
 * @param workflow ワークフロー（PENDING または作成直後）
 * @param skipReset サーバーをリセットしない場合は true
 * @param notificationMessage 通知メッセージのタイトル（デフォルト: "サーバー貸出が承認されました！"）
 * @param serverName 指定するサーバー名（省略時は自動割り当て）
 * @returns 割り当てられたサーバー名と終了日、またはエラー時は null
 */
export async function activateWorkflow(
  interaction: ActivationInteraction,
  workflow: WorkflowWithUsers,
  skipReset: boolean = false,
  notificationMessage: string = "サーバー貸出が承認されました！",
  serverName?: string,
): Promise<{ serverName: string; endDate: Date } | null> {
  // サーバーを取得（指定されている場合は指定サーバー、そうでない場合は自動割り当て）
  let availableServer: ServerBinding | null;
  if (serverName) {
    // 指定されたサーバー名からPterodactyl IDを解決
    const pteroId = await serverBindingService.getPteroId(serverName);
    if (!pteroId) {
      await interaction.editReply(
        `サーバー名 \`${serverName}\` は登録されていません。`,
      );
      return null;
    }
    // ServerBindingオブジェクトを取得
    const servers = await serverBindingService.list();
    availableServer = servers.find((s) => s.name === serverName) ?? null;
    if (!availableServer) {
      await interaction.editReply(
        `サーバー \`${serverName}\` が見つかりませんでした。`,
      );
      return null;
    }
  } else {
    // 利用可能なサーバーを自動検索
    availableServer = await workflowService.findAvailableServer();
    if (!availableServer) {
      await interaction.editReply(
        "利用可能なサーバーがありません。サーバーバインディングを確認してください。",
      );
      return null;
    }
  }

  // 実行するステップを決定
  type ActivationStep = "reinstall";
  const steps: ActivationStep[] = [];
  if (!skipReset) steps.push("reinstall");

  // 進捗トラッカーを初期化
  const progress = new ProgressTracker<ActivationStep>(
    interaction,
    "承認処理中",
    {
      reinstall: "サーバーを再インストール",
    },
    steps,
  );

  // サーバーを再インストール（skipReset=false の場合のみ）
  if (!skipReset) {
    await progress.execute("reinstall", async () => {
      await pterodactylCleanService.reinstall(
        availableServer.pteroId,
        workflow.mcVersion ?? "",
      );
    });
  }

  // ステータスを ACTIVE に更新
  const now = new Date();
  const endDate = new Date(
    now.getTime() + workflow.periodDays * 24 * 60 * 60 * 1000,
  );
  await workflowService.updateStatus({
    id: workflow.id,
    status: WorkflowStatus.ACTIVE,
    pteroServerId: availableServer.pteroId,
    startDate: now,
    endDate,
  });

  // サーバーの設定を更新（サブユーザー同期 + Description更新）
  const panelUserIds = workflow.panelUsers.map((u) => u.discordId);
  await updateServerSettings(
    availableServer.pteroId,
    workflow.organizerDiscordId,
    workflow.name,
    panelUserIds,
  );

  // 通知チャンネルに主催者へ通知
  try {
    const channel = await interaction.client.channels.fetch(
      env.DISCORD_NOTIFY_CHANNEL_ID,
    );
    if (channel?.isSendable()) {
      const embed = new EmbedBuilder()
        .setColor(0xe74c3c)
        .setTitle(`「${availableServer.name}」貸出`)
        .setDescription(notificationMessage)
        .addFields(
          ...workflowFields({
            ...workflow,
            endDate,
            serverName: availableServer.name,
          }),
        );

      const resetPasswordMention =
        commandMentions.mcserverResetPassword.resolve(interaction.guildId);
      const tutorialLinkButton = new ButtonBuilder()
        .setLabel("鯖管理パネルの詳しい使い方はこちら")
        .setStyle(ButtonStyle.Link)
        .setURL(
          "https://kamepowerworld.notion.site/Pterodactyl-bfd3f603523b47b5b19dfd785fd45841?source=copy_link",
        );
      await channel.send({
        content:
          `<@${workflow.organizerDiscordId}> サーバー貸し出しが承認されました！\n` +
          `${resetPasswordMention} からパスワードをリセット後、鯖管理パネルにログインできます！\n`,
        embeds: [embed],
        components: [
          new ActionRowBuilder<ButtonBuilder>().addComponents(
            tutorialLinkButton,
          ),
        ],
      });
    }
  } catch (error) {
    // 通知送信失敗は無視（ログには記録される）
    logger.error("Failed to send activation notification:", error);
  }

  // 全部確認ボードを更新
  await notificationBoardService.updateBoard(interaction.client);

  return { serverName: availableServer.name, endDate };
}

/**
 * 承認処理の本体：PENDING ワークフローを ACTIVE に遷移
 * @param interaction ボタン or モーダルのインタラクション（deferReply済み）
 * @param workflowId ワークフロー ID
 */
export async function completeApproval(
  interaction: ActivationInteraction,
  workflowId: number,
): Promise<void> {
  const workflow = await workflowService.findById(workflowId);
  if (!workflow) {
    await interaction.editReply("申請が見つかりませんでした。");
    return;
  }

  if (workflow.status !== WorkflowStatus.PENDING) {
    await interaction.editReply("この申請は既に処理されています。");
    return;
  }

  try {
    const result = await activateWorkflow(
      interaction,
      workflow,
      false,
      "サーバー貸出が承認されました！",
    );

    if (result) {
      await interaction.editReply(
        `承認完了！サーバー \`${result.serverName}\` を割り当てました。\n期限: <t:${Math.floor(result.endDate.getTime() / 1000)}:D>`,
      );
    }
  } catch (error) {
    logger.error("承認処理中にエラーが発生しました:", error);
    const message =
      error instanceof Error ? error.message : "不明なエラーが発生しました";
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      WorkflowApproveButton.buildRetry(workflowId),
    );
    await interaction.editReply({
      content: `エラーが発生しました: ${message}`,
      components: [row],
    });
  }
}
