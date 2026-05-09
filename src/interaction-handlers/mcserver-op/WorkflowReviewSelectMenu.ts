import { ApplyOptions } from "@sapphire/decorators";
import {
  InteractionHandler,
  InteractionHandlerTypes,
} from "@sapphire/framework";
import { MessageFlags, type StringSelectMenuInteraction } from "discord.js";
import { commandMentions } from "@/discord-utils/commands.js";
import { createWorkflowApprovalReview } from "@/domain/utils/workflowApprovalReview";
import { logger } from "@/utils/log";

/**
 * 申請確認対象を選ぶセレクトメニューのハンドラー
 */
@ApplyOptions<InteractionHandler.Options>({
  interactionHandlerType: InteractionHandlerTypes.SelectMenu,
})
export class WorkflowReviewSelectMenu extends InteractionHandler {
  public override parse(interaction: StringSelectMenuInteraction) {
    if (!interaction.customId.startsWith("workflow-review-select-menu")) {
      return this.none();
    }
    return this.some();
  }

  public override async run(interaction: StringSelectMenuInteraction) {
    // /mcserver-op が使える人のみ申請確認できる
    const isOp =
      interaction.inCachedGuild() &&
      (await commandMentions.mcserverOp.checkPermission(interaction.member));
    if (!isOp) {
      await interaction.reply({
        content: "この操作を実行する権限がありません。",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const workflowId = Number(interaction.values[0]);

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      const result = await createWorkflowApprovalReview(workflowId);
      if ("error" in result) {
        await interaction.editReply(result.error);
        return;
      }

      await interaction.editReply({
        embeds: [result.embed],
        components: [result.row],
      });
    } catch (error) {
      logger.error("申請確認セレクト処理中にエラーが発生しました:", error);
      const message =
        error instanceof Error ? error.message : "不明なエラーが発生しました";
      await interaction.editReply(`エラーが発生しました: ${message}`);
    }
  }
}
