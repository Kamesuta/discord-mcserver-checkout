import type { ButtonInteraction, TextChannel } from "discord.js";
import { WorkflowStatus } from "@/generated/prisma/client.js";
import env from "@/utils/env.js";
import { prisma } from "@/utils/prisma.js";
import { ArchiveName } from "../services/ArchiveName.js";
import { archiveService } from "../services/ArchiveService.js";
import { pterodactylCleanService } from "../services/pterodactyl/PterodactylCleanService.js";
import { pterodactylUserService } from "../services/pterodactyl/PterodactylUserService.js";
import { workflowService } from "../services/WorkflowService.js";

/**
 * 返却処理の本体：アーカイブ・サーバー再インストール・権限剥奪・通知
 * @param interaction ボタンのインタラクション（deferReply済み）
 * @param workflowId ワークフロー ID
 */
export async function completeReturn(
  interaction: ButtonInteraction,
  workflowId: number,
): Promise<void> {
  const workflow = await workflowService.findById(workflowId);
  if (!workflow || !workflow.pteroServerId) {
    await interaction.editReply("申請が見つかりませんでした。");
    return;
  }

  if (workflow.status !== WorkflowStatus.ACTIVE) {
    await interaction.editReply("この申請は ACTIVE ではありません。");
    return;
  }

  const serverId = workflow.pteroServerId;
  const guild = interaction.guild;

  // フォルダ名を構築: [ID]_YYYYMMdd_企画名_[Name]主催
  let organizerName = workflow.organizerDiscordId;
  if (guild) {
    try {
      const organizer = await guild.members.fetch(workflow.organizerDiscordId);
      organizerName = organizer.displayName;
    } catch {
      // ユーザー情報取得失敗時は Discord ID を使用
    }
  }

  const eventDate = workflow.eventDate ?? new Date();
  const archiveName = new ArchiveName({
    workflowId: workflow.id,
    workflowName: workflow.name,
    organizerName,
    eventDate,
    mcVersion: workflow.mcVersion ?? undefined,
  });

  // 1. バックアップアーカイブ（一時バックアップ作成 + ロック済み + rclone アップロード + ロック解除）
  await archiveService.archiveBackup(serverId, archiveName, "★");

  // 2. サーバー再インストール（初期化）
  await pterodactylCleanService.clean(serverId, workflow.mcVersion ?? "");

  // 3. パネルユーザーの権限剥奪
  const pteroUsers = await prisma.pterodactylUser.findMany({
    where: {
      discordId: { in: workflow.panelUsers.map((u) => u.discordId) },
    },
  });
  for (const pteroUser of pteroUsers) {
    await pterodactylUserService.removeUser(serverId, pteroUser.email);
  }

  // 4. ステータスを RETURNED に更新
  await workflowService.updateStatus({
    id: workflow.id,
    status: WorkflowStatus.RETURNED,
  });

  // 5. 通知チャンネルに主催者へ返却通知
  try {
    const channel = await interaction.client.channels.fetch(
      env.DISCORD_NOTIFY_CHANNEL_ID,
    );
    if (channel?.isTextBased()) {
      await (channel as TextChannel).send(
        `<@${workflow.organizerDiscordId}>\n` +
          `**サーバー貸出が返却されました。**\n\n` +
          `申請ID: ${workflow.id}\n` +
          `企画: ${workflow.name}\n` +
          `サーバーID: \`${serverId}\``,
      );
    }
  } catch (error) {
    // 通知送信失敗は無視（ログには記録される）
    console.error("Failed to send return notification:", error);
  }

  await interaction.editReply(
    `返却完了！サーバー \`${serverId}\` は初期化されました。`,
  );
}
