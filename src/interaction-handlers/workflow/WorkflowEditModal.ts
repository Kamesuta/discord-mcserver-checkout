import { ApplyOptions } from "@sapphire/decorators";
import {
  type InteractionHandler,
  InteractionHandlerTypes,
} from "@sapphire/framework";
import type { ModalBuilder, ModalSubmitInteraction } from "discord.js";
import { notifyNewPanelUsers } from "@/domain/flows/NotifyNewPanelUsers";
import type {
  BaseWorkflowParams,
  WorkflowWithUsers,
} from "@/domain/services/WorkflowService";
import { workflowService } from "@/domain/services/WorkflowService";
import { WorkflowStatus } from "@/generated/prisma/client";
import {
  type CheckoutModalDefaults,
  WorkflowBaseCheckoutModal,
} from "@/interaction-handlers/workflow/WorkflowBaseModal";
import { logger } from "@/utils/log";

@ApplyOptions<InteractionHandler.Options>({
  interactionHandlerType: InteractionHandlerTypes.ModalSubmit,
})
export class WorkflowEditModal extends WorkflowBaseCheckoutModal {
  static build(
    workflowId: number,
    defaults?: CheckoutModalDefaults,
  ): ModalBuilder {
    return WorkflowBaseCheckoutModal.buildModal(
      `edit-modal?${new URLSearchParams({ workflowId: String(workflowId) })}`,
      "申請編集",
      defaults,
    );
  }

  public override parse(interaction: ModalSubmitInteraction) {
    if (!interaction.customId.startsWith("edit-modal")) return this.none();
    return this.some();
  }

  // customId: edit-modal?workflowId=...
  protected override async execute(
    interaction: ModalSubmitInteraction,
    fields: BaseWorkflowParams,
  ): Promise<void> {
    const [, query] = interaction.customId.split("?");
    const workflowId = Number(new URLSearchParams(query).get("workflowId"));

    if (Number.isNaN(workflowId)) {
      await interaction.editReply("エラー: 申請IDが見つかりませんでした。");
      return;
    }

    try {
      // 申請を取得してステータスを確認
      const workflow = await workflowService.findById(workflowId);
      if (!workflow) {
        await interaction.editReply("申請が見つかりませんでした。");
        return;
      }

      // 基本フィールドを更新
      const { newPanelUsers } = await workflowService.update({
        id: workflowId,
        ...fields,
      });

      // 追加処理
      await this._handleEndDate(workflowId, workflow, fields);

      await interaction.editReply(
        `申請 (ID: \`${workflowId}\`) を編集しました。`,
      );

      await notifyNewPanelUsers(
        interaction.client,
        newPanelUsers,
        interaction.guild,
      );
    } catch (error) {
      logger.error("申請編集中にエラーが発生しました:", error);
      await interaction.editReply("申請の編集中にエラーが発生しました。");
    }
  }

  /**
   * 終了日を更新（ACTIVE状態の場合のみ）
   * startDateからperiodDays日後をendDateとして設定
   */
  private async _handleEndDate(
    workflowId: number,
    workflow: WorkflowWithUsers,
    fields: BaseWorkflowParams,
  ): Promise<void> {
    if (workflow.status !== WorkflowStatus.ACTIVE) return;

    const startDate = workflow.startDate ?? new Date();
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + fields.periodDays);
    await workflowService.updateEndDate(workflowId, endDate);
  }
}
