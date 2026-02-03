import { ApplyOptions } from "@sapphire/decorators";
import {
  type InteractionHandler,
  InteractionHandlerTypes,
} from "@sapphire/framework";
import type { ModalSubmitInteraction } from "discord.js";
import { activateWorkflow } from "@/domain/flows/ActivationFlow";
import type { BaseWorkflowParams } from "@/domain/services/WorkflowService";
import { workflowService } from "@/domain/services/WorkflowService";
import { BaseCheckoutModalHandler } from "@/interaction-handlers/workflow/WorkflowBaseModal";
import { logger } from "@/utils/log";

@ApplyOptions<InteractionHandler.Options>({
  interactionHandlerType: InteractionHandlerTypes.ModalSubmit,
})
export class WorkflowOpCreateModal extends BaseCheckoutModalHandler {
  public override parse(interaction: ModalSubmitInteraction) {
    if (!interaction.customId.startsWith("workflow-create")) return this.none();
    return this.some();
  }

  // customId: workflow-create?organizerId=...&applicantId=...&skipReset=...
  protected override async execute(
    interaction: ModalSubmitInteraction,
    fields: BaseWorkflowParams,
  ): Promise<void> {
    const [, query] = interaction.customId.split("?");
    const params = new URLSearchParams(query);
    const organizerId = params.get("organizerId");
    const applicantId = params.get("applicantId");
    const skipReset = params.get("skipReset") === "true";

    if (!organizerId) {
      await interaction.editReply("エラー: 主催者IDが見つかりませんでした。");
      return;
    }

    if (!applicantId) {
      await interaction.editReply("エラー: 申請者IDが見つかりませんでした。");
      return;
    }

    try {
      // 1. ワークフローを PENDING 状態で作成
      const createdWorkflow = await workflowService.create({
        ...fields,
        applicantDiscordId: applicantId,
        organizerDiscordId: organizerId,
      });

      // 2. panelUsers を含む完全なワークフローを取得
      const workflow = await workflowService.findById(createdWorkflow.id);
      if (!workflow) {
        await interaction.editReply("ワークフローの取得に失敗しました。");
        return;
      }

      // 3. 共通のアクティベーション処理を実行
      const result = await activateWorkflow(
        interaction,
        workflow,
        skipReset,
        "サーバー貸出が作成されました！",
      );

      if (result) {
        await interaction.editReply(
          `サーバー貸出を作成しました！\n` +
            `申請ID: \`${workflow.id}\`\n` +
            `サーバー: \`${result.serverName}\`\n` +
            `期限: ${result.endDate.toLocaleDateString("ja-JP")}` +
            (skipReset ? "\n⚠️ サーバーはリセットされていません" : ""),
        );
      }
    } catch (error) {
      logger.error("サーバー貸出作成中にエラーが発生しました:", error);
      const message =
        error instanceof Error ? error.message : "不明なエラーが発生しました";
      await interaction.editReply(`エラーが発生しました: ${message}`);
    }
  }
}
