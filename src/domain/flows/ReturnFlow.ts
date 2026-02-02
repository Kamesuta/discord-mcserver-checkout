import type { ModalSubmitInteraction } from "discord.js";
import { WorkflowStatus } from "@/generated/prisma/client.js";
import { prisma } from "@/utils/prisma.js";
import { archiveService } from "../services/ArchiveService.js";
import { pterodactylCleanService } from "../services/pterodactyl/PterodactylCleanService.js";
import { pterodactylUserService } from "../services/pterodactyl/PterodactylUserService.js";
import { workflowService } from "../services/WorkflowService.js";

/**
 * 返却処理の本体：アーカイブ・サーバー再インストール・権限剥奪・通知
 * @param interaction モーダルのインタラクション（deferReply済み）
 * @param workflowId ワークフロー ID
 * @param returnDate 返却日（モーダル入力の日付文字列）
 * @param comment 補足コメント
 */
export async function completeReturn(
  interaction: ModalSubmitInteraction,
  workflowId: number,
  returnDate: string,
  comment: string | undefined,
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

  // 1. バックアップアーカイブ（一時バックアップ作成 + ロック済み + rclone アップロード + ロック解除）
  await archiveService.archiveBackup(serverId, String(workflow.id));

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

  const guild = interaction.guild;

  // 5. パネルユーザーへ返却通知
  if (guild) {
    for (const panelUser of workflow.panelUsers) {
      try {
        const user = await guild.members.fetch(panelUser.discordId);
        await user.send(
          `サーバー貸出が返却されました。\n` +
            `企画: ${workflow.name}\n` +
            `サーバーID: \`${serverId}\`\n` +
            `返却日: ${returnDate}` +
            (comment ? `\nコメント: ${comment}` : ""),
        );
      } catch {
        // DM送信失敗は無視
      }
    }

    // 6. 主催者へ返却通知
    try {
      const organizer = await guild.members.fetch(workflow.organizerDiscordId);
      await organizer.send(
        `申請 (ID: ${workflow.id}) の返却が完了しました。\n` +
          `企画: ${workflow.name}\n` +
          `サーバーID: \`${serverId}\`\n` +
          `返却日: ${returnDate}` +
          (comment ? `\nコメント: ${comment}` : ""),
      );
    } catch {
      // DM送信失敗は無視
    }
  }

  await interaction.editReply(
    `返却完了！サーバー \`${serverId}\` は初期化されました。`,
  );
}
