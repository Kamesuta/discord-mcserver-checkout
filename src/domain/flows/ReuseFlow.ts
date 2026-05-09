import {
  ActionRowBuilder,
  type ButtonBuilder,
  type ButtonInteraction,
  EmbedBuilder,
} from "discord.js";
import { ProgressTracker } from "@/discord-utils/ProgressTracker";
import { updateServerSettings } from "@/domain/flows/ActivationFlow";
import { ArchiveName } from "@/domain/services/ArchiveName";
import { archiveService } from "@/domain/services/ArchiveService";
import { notificationBoardService } from "@/domain/services/NotificationBoardService";
import { pterodactylCleanService } from "@/domain/services/pterodactyl/PterodactylCleanService";
import { pterodactylService } from "@/domain/services/pterodactyl/PterodactylService";
import { pterodactylStartupService } from "@/domain/services/pterodactyl/PterodactylStartupService";
import { reuseDraftService } from "@/domain/services/ReuseDraftService";
import { serverBindingService } from "@/domain/services/ServerBindingService";
import { userService } from "@/domain/services/UserService";
import { workflowService } from "@/domain/services/WorkflowService";
import { WorkflowStatus } from "@/generated/prisma/client";
import { ReuseConfirmButton } from "@/interaction-handlers/mcserver/ReuseConfirmButton";
import env from "@/utils/env";
import { logger } from "@/utils/log";

/**
 * 流用確認画面を生成する
 */
export async function createReuseConfirmation(
  sourceWorkflowId: number,
  token: string,
): Promise<{ embed: EmbedBuilder; row: ActionRowBuilder<ButtonBuilder> }> {
  const draft = reuseDraftService.get(token);
  if (!draft) {
    throw new Error(
      "流用確認の有効期限が切れました。もう一度やり直してください。",
    );
  }

  const sourceWorkflow = await workflowService.findById(sourceWorkflowId);
  if (!sourceWorkflow?.pteroServerId) {
    throw new Error("流用元の申請が見つかりませんでした。");
  }

  const serverName =
    (await serverBindingService.getName(sourceWorkflow.pteroServerId)) ??
    sourceWorkflow.pteroServerId;

  const embed = new EmbedBuilder()
    .setColor(0xf39c12)
    .setTitle(`「${serverName}」流用確認`)
    .addFields(
      {
        name: "流用元",
        value: `${sourceWorkflow.name} (ID: ${sourceWorkflow.id})`,
      },
      { name: "流用先企画", value: draft.fields.name },
      {
        name: "補足説明",
        value: draft.fields.description || "なし",
      },
      {
        name: "サーバー",
        value: `${serverName} / ${sourceWorkflow.pteroServerId}`,
      },
      {
        name: "サーバーファイル",
        value:
          draft.fileMode === "keep"
            ? "保持する (鯖に入っているファイルはそのまま)"
            : "保持しない (リセットする)",
      },
      {
        name: "予定期限",
        value: `${draft.fields.periodDays}日後まで`,
      },
      {
        name: "注意",
        value:
          "現在のサーバーデータはバックアップ後に初期化され、新しい企画内容で引き継がれます。",
      },
    );

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    ReuseConfirmButton.build(token),
  );

  return { embed, row };
}

/**
 * 流用処理の本体
 */
export async function completeReuse(
  interaction: ButtonInteraction,
  token: string,
): Promise<void> {
  const draft = reuseDraftService.get(token);
  if (!draft) {
    await interaction.editReply(
      "流用確認の有効期限が切れました。もう一度やり直してください。",
    );
    return;
  }

  const sourceWorkflow = await workflowService.findById(draft.sourceWorkflowId);
  if (!sourceWorkflow?.pteroServerId) {
    await interaction.editReply("流用元の申請が見つかりませんでした。");
    return;
  }

  // 主催者固定が流用の前提。違っていたら通常申請でやり直してもらう。
  if (sourceWorkflow.organizerDiscordId !== draft.organizerDiscordId) {
    await interaction.editReply(
      "主催者が変更されているため、この流用は実行できません。通常の申請を行ってください。",
    );
    return;
  }

  // すでに流用済みの再試行に備え、RETURNED + 新ワークフローACTIVEの組み合わせは成功扱いにする。
  let targetWorkflow = draft.createdWorkflowId
    ? await workflowService.findById(draft.createdWorkflowId)
    : null;
  if (
    sourceWorkflow.status === WorkflowStatus.RETURNED &&
    targetWorkflow?.status === WorkflowStatus.ACTIVE &&
    targetWorkflow.pteroServerId === sourceWorkflow.pteroServerId
  ) {
    const serverName =
      (await serverBindingService.getName(sourceWorkflow.pteroServerId)) ??
      sourceWorkflow.pteroServerId;
    await interaction.editReply(
      `既に流用済みです。サーバー \`${serverName}\` を「${targetWorkflow.name}」へ引き継いでいます。`,
    );
    reuseDraftService.delete(token);
    return;
  }

  if (sourceWorkflow.status !== WorkflowStatus.ACTIVE) {
    await interaction.editReply("この申請は現在流用できません。");
    return;
  }

  if (sourceWorkflow.organizerDiscordId !== interaction.user.id) {
    await interaction.editReply("この申請を流用する権限がありません。");
    return;
  }

  // 初回実行時のみ新ワークフローを作成し、失敗時は同じIDで再試行できるようにする。
  if (!targetWorkflow) {
    const created = await workflowService.create({
      ...draft.fields,
      applicantDiscordId: draft.applicantDiscordId,
      organizerDiscordId: draft.organizerDiscordId,
    });
    reuseDraftService.setCreatedWorkflowId(token, created.workflow.id);

    targetWorkflow = await workflowService.findById(created.workflow.id);
    if (!targetWorkflow) {
      throw new Error("流用先ワークフローの作成に失敗しました。");
    }
  }

  if (targetWorkflow.status !== WorkflowStatus.PENDING) {
    await interaction.editReply("流用先ワークフローの状態が不正です。");
    return;
  }

  const serverId = sourceWorkflow.pteroServerId;
  const serverName =
    (await serverBindingService.getName(serverId)) ??
    sourceWorkflow.pteroServerId;

  // 返却フローと同様に、停止 -> バックアップ -> 必要なら初期化を順に進める。
  type ReuseStep = "stop" | "archive" | "reset" | "activate";
  const steps: ReuseStep[] = ["stop", "archive"];
  if (draft.fileMode === "reset") {
    steps.push("reset");
  }
  steps.push("activate");
  const progress = new ProgressTracker<ReuseStep>(
    interaction,
    "流用処理中",
    {
      stop: "サーバーを停止",
      archive: "流用前バックアップを作成",
      reset: "サーバーを初期化",
      activate: "新しい企画内容へ切り替え",
    },
    steps,
  );

  await progress.execute("stop", async () => {
    const stopResult = await pterodactylService.setPowerState(serverId, "stop");
    await stopResult.wait();
  });

  await progress.execute("archive", async () => {
    const organizerUser = await userService.findByDiscordId(
      sourceWorkflow.organizerDiscordId,
    );
    const organizerName =
      organizerUser?.nickname ?? sourceWorkflow.organizerDiscordId;
    const mcVersion = await pterodactylStartupService.getMinecraftVersion(
      serverId,
      sourceWorkflow.mcVersion ?? undefined,
    );
    const archiveName = new ArchiveName({
      workflowId: sourceWorkflow.id,
      workflowName: sourceWorkflow.name,
      organizerName,
      eventDate: sourceWorkflow.eventDate ?? new Date(),
      mcVersion,
    });

    await archiveService.archiveBackup(serverId, archiveName, "★");
  });

  if (draft.fileMode === "reset") {
    await progress.execute("reset", async () => {
      await pterodactylCleanService.reset(serverId);
    });
  }

  await progress.execute("activate", async () => {
    const now = new Date();
    const endDate = new Date(
      now.getTime() + targetWorkflow.periodDays * 24 * 60 * 60 * 1000,
    );

    // 旧企画は返却済みにし、同じサーバーを新企画へ付け替える。
    await workflowService.activateReuse({
      sourceWorkflowId: sourceWorkflow.id,
      targetWorkflowId: targetWorkflow.id,
      pteroServerId: serverId,
      startDate: now,
      endDate,
    });

    await updateServerSettings(
      serverId,
      targetWorkflow.organizerDiscordId,
      targetWorkflow.name,
      targetWorkflow.panelUsers.map((user) => user.discordId),
    );
  });

  const activeTargetWorkflow = await workflowService.findById(
    targetWorkflow.id,
  );
  if (!activeTargetWorkflow?.endDate) {
    throw new Error("流用後ワークフローの更新確認に失敗しました。");
  }

  // 通知チャンネルには「流用した」事実をまとめて記録する。
  try {
    const channel = await interaction.client.channels.fetch(
      env.DISCORD_NOTIFY_CHANNEL_ID,
    );
    if (channel?.isSendable()) {
      const embed = new EmbedBuilder()
        .setColor(0x9b59b6)
        .setTitle(`「${serverName}」流用`)
        .addFields(
          {
            name: "流用元",
            value: `${sourceWorkflow.name} (ID: ${sourceWorkflow.id})`,
          },
          {
            name: "流用先",
            value: `${activeTargetWorkflow.name} (ID: ${activeTargetWorkflow.id})`,
          },
          {
            name: "補足説明",
            value: activeTargetWorkflow.description || "なし",
          },
          {
            name: "サーバーファイル",
            value:
              draft.fileMode === "keep"
                ? "保持する (鯖に入っているファイルはそのまま)"
                : "保持しない (リセットする)",
          },
          {
            name: "サーバーID",
            value: serverId,
            inline: true,
          },
          {
            name: "サーバー名",
            value: serverName,
            inline: true,
          },
          {
            name: "新しい期限",
            value: `<t:${Math.floor(activeTargetWorkflow.endDate.getTime() / 1000)}:D>`,
            inline: true,
          },
        );

      await channel.send({
        content:
          `<@${interaction.user.id}> がサーバーを流用しました。\n` +
          `主催者: <@${activeTargetWorkflow.organizerDiscordId}>`,
        embeds: [embed],
      });
    }
  } catch (error) {
    // 通知失敗は処理全体の失敗にしない。
    logger.error("Failed to send reuse notification:", error);
  }

  await notificationBoardService.updateBoard(interaction.client);
  reuseDraftService.delete(token);

  await interaction.editReply(
    `流用完了！サーバー \`${serverName}\` を「${activeTargetWorkflow.name}」へ引き継ぎました。\n` +
      `サーバーファイル: ${draft.fileMode === "keep" ? "保持" : "リセット"}\n` +
      `新しい期限: <t:${Math.floor(activeTargetWorkflow.endDate.getTime() / 1000)}:D>`,
  );
}
