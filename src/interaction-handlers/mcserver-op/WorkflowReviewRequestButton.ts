import { ApplyOptions } from "@sapphire/decorators";
import {
  InteractionHandler,
  InteractionHandlerTypes,
} from "@sapphire/framework";
import {
  ActionRowBuilder,
  ButtonBuilder,
  type ButtonInteraction,
  ButtonStyle,
  MessageFlags,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from "discord.js";
import { commandMentions } from "@/discord-utils/commands.js";
import { workflowService } from "@/domain/services/WorkflowService";
import { WorkflowStatus } from "@/generated/prisma/client";
import { logger } from "@/utils/log";

/**
 * 全部確認ボードの「申請確認」ボタンハンドラー
 */
@ApplyOptions<InteractionHandler.Options>({
  interactionHandlerType: InteractionHandlerTypes.Button,
})
export class WorkflowReviewRequestButton extends InteractionHandler {
  /**
   * 管理者向け申請確認ボタンを作成
   */
  static build(): ButtonBuilder {
    return new ButtonBuilder()
      .setCustomId("workflow-review-request-button")
      .setLabel("管理用:申請確認")
      .setStyle(ButtonStyle.Secondary);
  }

  public override parse(interaction: ButtonInteraction) {
    if (!interaction.customId.startsWith("workflow-review-request-button")) {
      return this.none();
    }
    return this.some();
  }

  public override async run(interaction: ButtonInteraction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    // /mcserver-op が使える人のみ申請確認できる
    const isOp =
      interaction.inCachedGuild() &&
      (await commandMentions.mcserverOp.checkPermission(interaction.member));
    if (!isOp) {
      await interaction.editReply("この操作を実行する権限がありません。");
      return;
    }

    try {
      const workflows = await workflowService.findByStatus(
        WorkflowStatus.PENDING,
      );

      if (workflows.length === 0) {
        await interaction.editReply("承認待ちの申請はありません。");
        return;
      }

      const options = workflows.slice(0, 25).map((workflow) => {
        const applicantText =
          workflow.applicantDiscordId === workflow.organizerDiscordId
            ? ""
            : ` / 申請者:${workflow.applicantDiscordId}`;

        return new StringSelectMenuOptionBuilder()
          .setLabel(`ID:${workflow.id} - ${workflow.name}`)
          .setDescription(
            `主催者:${workflow.organizerDiscordId}${applicantText}`.slice(
              0,
              100,
            ),
          )
          .setValue(workflow.id.toString());
      });

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId("workflow-review-select-menu")
        .setPlaceholder("確認する申請を選択してください")
        .addOptions(options);

      const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        selectMenu,
      );

      await interaction.editReply({
        content: "確認する承認待ち申請を選択してください：",
        components: [row],
      });
    } catch (error) {
      logger.error("申請確認ボタン処理中にエラーが発生しました:", error);
      const message =
        error instanceof Error ? error.message : "不明なエラーが発生しました";
      await interaction.editReply(`エラーが発生しました: ${message}`);
    }
  }
}
