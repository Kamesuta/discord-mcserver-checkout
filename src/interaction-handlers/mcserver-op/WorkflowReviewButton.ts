import { ApplyOptions } from "@sapphire/decorators";
import {
  InteractionHandler,
  InteractionHandlerTypes,
} from "@sapphire/framework";
import {
  ButtonBuilder as Builder,
  type ButtonInteraction,
  ButtonStyle,
  MessageFlags,
} from "discord.js";
import { commandMentions } from "@/discord-utils/commands";
import { customIdParams } from "@/discord-utils/customIds";
import { createWorkflowApprovalReview } from "@/domain/utils/workflowApprovalReview";
import { logger } from "@/utils/log";

/**
 * 申請確認ボタンハンドラー
 * 申請内容の確認画面を表示し、承認/却下を選択できるようにする
 */
@ApplyOptions<InteractionHandler.Options>({
  interactionHandlerType: InteractionHandlerTypes.Button,
})
export class WorkflowReviewButton extends InteractionHandler {
  /**
   * 確認ボタンを作成
   */
  static build(workflowId: number): Builder {
    return new Builder()
      .setCustomId(
        `review-button?${new URLSearchParams({ [customIdParams.workflowId]: String(workflowId) })}`,
      )
      .setLabel("確認する")
      .setStyle(ButtonStyle.Primary);
  }

  public override parse(interaction: ButtonInteraction) {
    if (!interaction.customId.startsWith("review-button")) return this.none();
    return this.some();
  }

  public override async run(interaction: ButtonInteraction) {
    // /mcserver-op が使える人のみ確認できる
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

    const [, query] = interaction.customId.split("?");
    const id = Number(
      new URLSearchParams(query).get(customIdParams.workflowId),
    );

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      const result = await createWorkflowApprovalReview(id);
      if ("error" in result) {
        await interaction.editReply(result.error);
        return;
      }
      await interaction.editReply({
        embeds: [result.embed],
        components: [result.row],
      });
    } catch (error) {
      logger.error(error);
      const message =
        error instanceof Error ? error.message : "不明なエラーが発生しました";
      await interaction.editReply(`エラーが発生しました: ${message}`);
    }
  }
}
