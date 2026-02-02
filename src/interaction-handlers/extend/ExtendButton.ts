import { ApplyOptions } from "@sapphire/decorators";
import {
  InteractionHandler,
  InteractionHandlerTypes,
} from "@sapphire/framework";
import type { ButtonInteraction } from "discord.js";
import { workflowService } from "@/domain/services/WorkflowService.js";
import { WorkflowStatus } from "@/generated/prisma/client.js";
import { logger } from "@/utils/log.js";

@ApplyOptions<InteractionHandler.Options>({
  interactionHandlerType: InteractionHandlerTypes.Button,
})
export class ExtendButton extends InteractionHandler {
  public override parse(interaction: ButtonInteraction) {
    if (!interaction.customId.startsWith("extend-workflow")) return this.none();
    return this.some();
  }

  public override async run(interaction: ButtonInteraction) {
    const [, query] = interaction.customId.split("?");
    const params = new URLSearchParams(query);
    const workflowId = Number(params.get("workflowId"));

    await interaction.deferReply({ ephemeral: true });

    try {
      const workflow = await workflowService.findById(workflowId);
      if (!workflow) {
        await interaction.editReply("申請が見つかりませんでした。");
        return;
      }

      if (workflow.status !== WorkflowStatus.ACTIVE || !workflow.endDate) {
        await interaction.editReply("この申請は延長できません。");
        return;
      }

      // ボタンを押したユーザーが主催者か確認
      if (workflow.organizerDiscordId !== interaction.user.id) {
        await interaction.editReply("この申請の主催者のみが延長できます。");
        return;
      }

      // 1週間（7日）延長
      const currentEndDate = new Date(workflow.endDate);
      const newEndDate = new Date(
        currentEndDate.getTime() + 7 * 24 * 60 * 60 * 1000,
      );

      await workflowService.updateEndDate(workflowId, newEndDate);

      await interaction.editReply(
        `申請 (ID: ${workflowId}) を1週間延長しました。\n` +
          `新しい期限: ${newEndDate.toLocaleDateString("ja-JP")}`,
      );

      logger.info(
        `Workflow ${workflowId} extended by ${interaction.user.id} (${interaction.user.tag})`,
      );
    } catch (error) {
      logger.error("延長処理中にエラーが発生しました:", error);
      const message =
        error instanceof Error ? error.message : "不明なエラーが発生しました";
      await interaction.editReply(`エラーが発生しました: ${message}`);
    }
  }
}
