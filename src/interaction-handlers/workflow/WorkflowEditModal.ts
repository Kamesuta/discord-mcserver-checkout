import { ApplyOptions } from "@sapphire/decorators";
import {
  type InteractionHandler,
  InteractionHandlerTypes,
} from "@sapphire/framework";
import type { ModalSubmitInteraction } from "discord.js";
import { pterodactylUserService } from "@/domain/services/pterodactyl/PterodactylUserService";
import type {
  BaseWorkflowParams,
  WorkflowWithUsers,
} from "@/domain/services/WorkflowService";
import { workflowService } from "@/domain/services/WorkflowService";
import { WorkflowStatus } from "@/generated/prisma/client";
import { BaseCheckoutModalHandler } from "@/interaction-handlers/workflow/WorkflowBaseModal";
import { logger } from "@/utils/log";

@ApplyOptions<InteractionHandler.Options>({
  interactionHandlerType: InteractionHandlerTypes.ModalSubmit,
})
export class EditModalHandler extends BaseCheckoutModalHandler {
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
      await workflowService.update({
        id: workflowId,
        ...fields,
      });

      // 追加処理
      await this._handleEndDate(workflowId, workflow, fields);
      const warnings = await this._handlePanelUsers(workflow, fields);

      let message = `申請 (ID: \`${workflowId}\`) を編集しました。`;
      if (warnings.length > 0) {
        message += `\n\n⚠️ 警告:\n${warnings.join("\n")}`;
      }

      await interaction.editReply(message);
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

  /**
   * パネルユーザーの変更をPterodactylに同期（ACTIVE状態の場合のみ）
   * @returns 警告メッセージの配列
   */
  private async _handlePanelUsers(
    workflow: WorkflowWithUsers,
    fields: BaseWorkflowParams,
  ): Promise<string[]> {
    if (workflow.status !== WorkflowStatus.ACTIVE) return [];
    if (!workflow.pteroServerId) return [];

    const warnings: string[] = [];

    const oldDiscordIds = workflow.panelUsers.map((u) => u.discordId);
    const newDiscordIds = fields.panelUsers;

    // 追加されたユーザー
    const addedDiscordIds = newDiscordIds.filter(
      (id) => !oldDiscordIds.includes(id),
    );

    // 削除されたユーザー
    const removedDiscordIds = oldDiscordIds.filter(
      (id) => !newDiscordIds.includes(id),
    );

    // 追加されたユーザーをPterodactylに追加
    if (addedDiscordIds.length > 0) {
      const addedPteroUsers =
        await pterodactylUserService.findByDiscordIds(addedDiscordIds);

      // 登録されていないユーザーを確認
      const foundDiscordIds = addedPteroUsers.map((u) => u.discordId);
      const unregisteredDiscordIds = addedDiscordIds.filter(
        (id) => !foundDiscordIds.includes(id),
      );

      if (unregisteredDiscordIds.length > 0) {
        warnings.push(
          `以下のユーザーは Pterodactyl に登録されていません。\`/mcserver-admin user register\` で登録してください: ${unregisteredDiscordIds.map((id) => `<@${id}>`).join(", ")}`,
        );
      }

      for (const pteroUser of addedPteroUsers) {
        try {
          await pterodactylUserService.addUser(
            workflow.pteroServerId,
            pteroUser.email,
          );
        } catch (error) {
          logger.error(
            `ユーザー ${pteroUser.email} の追加中にエラーが発生しました:`,
            error,
          );
        }
      }
    }

    // 削除されたユーザーをPterodactylから削除
    if (removedDiscordIds.length > 0) {
      const removedPteroUsers =
        await pterodactylUserService.findByDiscordIds(removedDiscordIds);

      for (const pteroUser of removedPteroUsers) {
        try {
          await pterodactylUserService.removeUser(
            workflow.pteroServerId,
            pteroUser.email,
          );
        } catch (error) {
          logger.error(
            `ユーザー ${pteroUser.email} の削除中にエラーが発生しました:`,
            error,
          );
        }
      }
    }

    return warnings;
  }
}
