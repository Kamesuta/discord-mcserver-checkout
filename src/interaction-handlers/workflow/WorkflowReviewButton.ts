import { ApplyOptions } from "@sapphire/decorators";
import {
  InteractionHandler,
  InteractionHandlerTypes,
} from "@sapphire/framework";
import {
  ActionRowBuilder,
  ButtonBuilder as Builder,
  type ButtonBuilder,
  type ButtonInteraction,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
} from "discord.js";
import { commandMentions } from "@/discord-utils/commands";
import { customIdParams } from "@/discord-utils/customIds";
import { userService } from "@/domain/services/UserService";
import { workflowService } from "@/domain/services/WorkflowService";
import { workflowFields } from "@/domain/utils/workflowFields";
import { WorkflowStatus } from "@/generated/prisma/client";
import { WorkflowApproveButton } from "@/interaction-handlers/workflow/WorkflowApproveButton";
import { WorkflowRegisterButton } from "@/interaction-handlers/workflow/WorkflowRegisterButton";
import { WorkflowRejectButton } from "@/interaction-handlers/workflow/WorkflowRejectButton";
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
    // 管理者権限をチェック
    const isAdmin =
      interaction.inCachedGuild() &&
      (await commandMentions.mcserverOp.checkPermission(interaction.member));

    if (!isAdmin) {
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
      const workflow = await workflowService.findById(id);

      if (!workflow) {
        await interaction.editReply("申請が見つかりませんでした。");
        return;
      }

      if (workflow.status !== WorkflowStatus.PENDING) {
        await interaction.editReply("PENDING の申請のみ承認できます。");
        return;
      }

      // 未登録のパネルユーザーを検索
      const unregistered: string[] = [];
      for (const panelUser of workflow.panelUsers) {
        const pteroUser = await userService.findByDiscordId(
          panelUser.discordId,
        );
        // ユーザーレコードが存在しない、または registered が false、または username が未設定の場合は未登録
        if (!pteroUser || !pteroUser.registered || !pteroUser.username) {
          unregistered.push(panelUser.discordId);
        }
      }

      // 申請内容 Embed
      const embed = new EmbedBuilder()
        .setTitle(`申請内容`)
        .setColor(unregistered.length > 0 ? 0xf39c12 : 0x2ecc71)
        .addFields(
          ...workflowFields(workflow),
          {
            name: "パネルユーザー",
            value: workflow.panelUsers
              .map(
                (u) =>
                  `<@${u.discordId}> ${unregistered.includes(u.discordId) ? "⚠️ 未登録" : "✅ 登録済み"}`,
              )
              .join("\n"),
          },
          { name: "バージョン", value: workflow.mcVersion ?? "未指定" },
          { name: "期間", value: `${workflow.periodDays}日` },
        );

      if (workflow.description) {
        embed.addFields({ name: "補足", value: workflow.description });
      }

      // ボタン
      if (unregistered.length > 0) {
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          WorkflowRegisterButton.build(workflow.id, unregistered),
          WorkflowRejectButton.build(workflow.id),
        );
        await interaction.editReply({ embeds: [embed], components: [row] });
      } else {
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          WorkflowApproveButton.build(workflow.id),
          WorkflowRejectButton.build(workflow.id),
        );
        await interaction.editReply({ embeds: [embed], components: [row] });
      }
    } catch (error) {
      logger.error(error);
      const message =
        error instanceof Error ? error.message : "不明なエラーが発生しました";
      await interaction.editReply(`エラーが発生しました: ${message}`);
    }
  }
}
