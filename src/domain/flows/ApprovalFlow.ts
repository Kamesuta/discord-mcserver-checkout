import type { ButtonInteraction, ModalSubmitInteraction } from "discord.js";
import { WorkflowStatus } from "../../generated/prisma/client.js";
import env from "../../utils/env.js";
import { prisma } from "../../utils/prisma.js";
import { pterodactylCleanService } from "../services/pterodactyl/PterodactylCleanService.js";
import { pterodactylUserService } from "../services/pterodactyl/PterodactylUserService.js";
import { workflowService } from "../services/WorkflowService.js";

type ApprovalInteraction = ButtonInteraction | ModalSubmitInteraction;

/**
 * 承認処理の本体：ロール付与・サーバー割り当て・パネルユーザー追加・通知
 * @param interaction ボタン or モーダルのインタラクション（deferReply済み）
 * @param workflowId ワークフロー ID
 */
export async function completeApproval(
  interaction: ApprovalInteraction,
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

  const guild = interaction.guild;
  if (!guild) {
    await interaction.editReply("Guild情報が取得できませんでした。");
    return;
  }

  // 1. パネルユーザーに Discord ロール付与（未付与の場合のみ）
  for (const panelUser of workflow.panelUsers) {
    const member = await guild.members.fetch(panelUser.discordId);
    if (!member.roles.cache.has(env.DISCORD_PANEL_USER_ROLE_ID)) {
      await member.roles.add(env.DISCORD_PANEL_USER_ROLE_ID);
    }
  }

  // 2. 利用可能なサーバーを検索
  const availableServer = await workflowService.findAvailableServer();
  if (!availableServer) {
    await interaction.editReply(
      "利用可能なサーバーがありません。サーバーバインディングを確認してください。",
    );
    return;
  }

  // 3. パネルにユーザー追加・権限付与
  const pteroUsers = await prisma.pterodactylUser.findMany({
    where: {
      discordId: { in: workflow.panelUsers.map((u) => u.discordId) },
    },
  });

  for (const pteroUser of pteroUsers) {
    await pterodactylUserService.addUser(
      availableServer.pteroId,
      pteroUser.email,
    );
  }

  // 4. サーバーをクリーン（初期状態リセット）
  await pterodactylCleanService.clean(
    availableServer.pteroId,
    workflow.mcVersion ?? "",
  );

  // 5. ステータスを ACTIVE に更新
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

  // 6. パネルユーザーへ通知
  for (const panelUser of workflow.panelUsers) {
    try {
      const user = await guild.members.fetch(panelUser.discordId);
      await user.send(
        `サーバー貸出が承認されました！\n` +
          `サーバーID: \`${availableServer.pteroId}\`\n` +
          `企画: ${workflow.name}\n` +
          `期限: ${endDate.toLocaleDateString("ja-JP")}`,
      );
    } catch {
      // DM送信失敗は無視
    }
  }

  // 7. 主催者へ通知
  try {
    const organizer = await guild.members.fetch(workflow.organizerDiscordId);
    await organizer.send(
      `申請 (ID: ${workflow.id}) が承認されました！\n` +
        `割り当てサーバー: \`${availableServer.pteroId}\`\n` +
        `期限: ${endDate.toLocaleDateString("ja-JP")}`,
    );
  } catch {
    // DM送信失敗は無視
  }

  await interaction.editReply(
    `承認完了！サーバー \`${availableServer.pteroId}\` を割り当てました。\n期限: ${endDate.toLocaleDateString("ja-JP")}`,
  );
}
