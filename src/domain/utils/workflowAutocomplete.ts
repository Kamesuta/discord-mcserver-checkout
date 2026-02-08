import type { AutocompleteInteraction } from "discord.js";
import { workflowService } from "@/domain/services/WorkflowService";
import type { WorkflowStatus } from "@/generated/prisma/client";
import { logger } from "@/utils/log";

/**
 * ワークフローのオートコンプリートを実装する共通ヘルパー関数
 *
 * @param interaction オートコンプリートインタラクション
 * @param statuses フィルタリングするワークフローステータス（指定しない場合は全ステータス）
 * @param options 追加のフィルタリングオプション
 * @param options.organizerOnly trueの場合、自分が主催者の申請のみを表示
 */
export async function workflowAutocomplete(
  interaction: AutocompleteInteraction,
  statuses?: WorkflowStatus[],
  options?: {
    organizerOnly?: boolean;
  },
): Promise<void> {
  try {
    const focusedValue = interaction.options.getFocused().toString();

    // データベースからワークフローを取得
    let workflows = statuses
      ? await workflowService.findByStatuses(statuses)
      : await workflowService.findAll();

    // 主催者フィルター
    if (options?.organizerOnly) {
      workflows = workflows.filter(
        (wf) => wf.organizerDiscordId === interaction.user.id,
      );
    }

    // 入力値でフィルタリング（IDまたは企画名で検索）
    const filtered = workflows
      .filter(
        (workflow) =>
          workflow.id.toString().includes(focusedValue) ||
          workflow.name.toLowerCase().includes(focusedValue.toLowerCase()),
      )
      .slice(0, 25); // Discordの制限

    await interaction.respond(
      filtered.map((workflow) => ({
        name: `ID: ${workflow.id} - ${workflow.name.length > 70 ? `${workflow.name.substring(0, 67)}...` : workflow.name}`,
        value: workflow.id,
      })),
    );
  } catch (error) {
    logger.error("オートコンプリートエラー:", error);
    await interaction.respond([]);
  }
}
