import { ApplyOptions } from "@sapphire/decorators";
import {
  type InteractionHandler,
  InteractionHandlerTypes,
} from "@sapphire/framework";
import {
  ActionRowBuilder,
  type ButtonBuilder,
  type ModalBuilder,
  type ModalSubmitInteraction,
} from "discord.js";
import { customIdParams } from "@/discord-utils/customIds";
import { activateWorkflow } from "@/domain/flows/ActivationFlow";
import type { BaseWorkflowParams } from "@/domain/services/WorkflowService";
import { workflowService } from "@/domain/services/WorkflowService";
import { WorkflowApproveButton } from "@/interaction-handlers/workflow/WorkflowApproveButton";
import {
  type CheckoutModalDefaults,
  WorkflowBaseCheckoutModal,
} from "@/interaction-handlers/workflow/WorkflowBaseModal";
import { logger } from "@/utils/log";

@ApplyOptions<InteractionHandler.Options>({
  interactionHandlerType: InteractionHandlerTypes.ModalSubmit,
})
export class WorkflowOpCreateModal extends WorkflowBaseCheckoutModal {
  static build(
    organizerId: string,
    applicantId: string,
    skipReset: boolean,
    serverName?: string,
    defaults?: CheckoutModalDefaults,
  ): ModalBuilder {
    const params: Record<string, string> = {
      [customIdParams.organizerId]: organizerId,
      [customIdParams.applicantId]: applicantId,
      [customIdParams.skipReset]: String(skipReset),
    };
    if (serverName) {
      params[customIdParams.serverName] = serverName;
    }
    return WorkflowBaseCheckoutModal.buildModal(
      `workflow-create?${new URLSearchParams(params)}`,
      "サーバー貸出作成（管理者）",
      defaults,
    );
  }

  public override parse(interaction: ModalSubmitInteraction) {
    if (!interaction.customId.startsWith("workflow-create")) return this.none();
    return this.some();
  }

  // customId: workflow-create?o=...&a=...&sr=...&s=...
  protected override async execute(
    interaction: ModalSubmitInteraction,
    fields: BaseWorkflowParams,
  ): Promise<void> {
    const [, query] = interaction.customId.split("?");
    const params = new URLSearchParams(query);
    const organizerId = params.get(customIdParams.organizerId);
    const applicantId = params.get(customIdParams.applicantId);
    const skipReset = params.get(customIdParams.skipReset) === "true";
    const serverName = params.get(customIdParams.serverName) ?? undefined;

    if (!organizerId) {
      await interaction.editReply("エラー: 主催者IDが見つかりませんでした。");
      return;
    }

    if (!applicantId) {
      await interaction.editReply("エラー: 申請者IDが見つかりませんでした。");
      return;
    }

    let createdWorkflowId: number | null = null;

    try {
      // 1. ワークフローを PENDING 状態で作成
      const { workflow: createdWorkflow } = await workflowService.create({
        ...fields,
        applicantDiscordId: applicantId,
        organizerDiscordId: organizerId,
      });
      createdWorkflowId = createdWorkflow.id;

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
        serverName,
      );

      if (result) {
        await interaction.editReply(
          `サーバーを貸し出しました！ (ID: ${workflow.id})` +
            (skipReset ? "\n⚠️ サーバーはリセットされていません" : ""),
        );
      }
    } catch (error) {
      logger.error("サーバー貸出作成中にエラーが発生しました:", error);
      const message =
        error instanceof Error ? error.message : "不明なエラーが発生しました";
      if (createdWorkflowId) {
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          WorkflowApproveButton.buildRetry(createdWorkflowId),
        );
        await interaction.editReply({
          content: `エラーが発生しました: ${message}\n申請ID: \`${createdWorkflowId}\``,
          components: [row],
        });
      } else {
        await interaction.editReply(`エラーが発生しました: ${message}`);
      }
    }
  }
}
