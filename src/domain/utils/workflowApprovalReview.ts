import { ActionRowBuilder, type ButtonBuilder, EmbedBuilder } from "discord.js";
import { userService } from "@/domain/services/UserService";
import { workflowService } from "@/domain/services/WorkflowService";
import { serverTypeLabels } from "@/domain/utils/serverType";
import { workflowFields } from "@/domain/utils/workflowFields";
import { WorkflowStatus } from "@/generated/prisma/client";
import { WorkflowApproveButton } from "@/interaction-handlers/mcserver-op/WorkflowApproveButton";
import { WorkflowRegisterButton } from "@/interaction-handlers/mcserver-op/WorkflowRegisterButton";
import { WorkflowRejectButton } from "@/interaction-handlers/mcserver-op/WorkflowRejectButton";

/**
 * 承認確認画面の表示内容を構築する
 *
 * `/mcserver-op workflow approve` とボタン起点の承認確認を同じ見た目・同じ条件に揃える。
 */
export async function createWorkflowApprovalReview(workflowId: number): Promise<
  | {
      embed: EmbedBuilder;
      row: ActionRowBuilder<ButtonBuilder>;
    }
  | {
      error: string;
    }
> {
  const workflow = await workflowService.findById(workflowId);

  if (!workflow) {
    return { error: "申請が見つかりませんでした。" };
  }

  if (workflow.status !== WorkflowStatus.PENDING) {
    return { error: "PENDING の申請のみ承認できます。" };
  }

  // 未登録のパネルユーザーを検索
  const unregistered: string[] = [];
  for (const panelUser of workflow.panelUsers) {
    const pteroUser = await userService.findByDiscordId(panelUser.discordId);
    // ユーザーレコードが存在しない、または registered が false、
    // または username が未設定の場合は未登録
    if (!pteroUser || !pteroUser.registered || !pteroUser.username) {
      unregistered.push(panelUser.discordId);
    }
  }

  // 申請内容 Embed
  const embed = new EmbedBuilder()
    .setTitle("申請内容")
    .setColor(unregistered.length > 0 ? 0xf39c12 : 0x2ecc71)
    .addFields(
      ...workflowFields(workflow),
      {
        name: "パネルユーザー",
        value: workflow.panelUsers
          .map(
            (user) =>
              `<@${user.discordId}> ${unregistered.includes(user.discordId) ? "⚠️ 未登録" : "✅ 登録済み"}`,
          )
          .join("\n"),
      },
      { name: "種別", value: serverTypeLabels[workflow.serverType] },
      { name: "バージョン", value: workflow.mcVersion ?? "未指定" },
      { name: "期間", value: `${workflow.periodDays}日` },
    );

  if (workflow.description) {
    embed.addFields({ name: "補足", value: workflow.description });
  }

  // ボタン
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    ...(unregistered.length > 0
      ? [
          WorkflowRegisterButton.build(workflow.id, unregistered),
          WorkflowRejectButton.build(workflow.id),
        ]
      : [
          WorkflowApproveButton.build(workflow.id),
          WorkflowRejectButton.build(workflow.id),
        ]),
  );

  return { embed, row };
}
