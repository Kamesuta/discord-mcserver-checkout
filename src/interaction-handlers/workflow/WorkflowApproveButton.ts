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
} from "discord.js";
import { customIdParams } from "@/discord-utils/customIds";
import { completeApproval } from "@/domain/flows/ActivationFlow";
import { workflowService } from "@/domain/services/WorkflowService";
import { WorkflowRegisterModal } from "@/interaction-handlers/workflow/WorkflowRegisterModal";
import { logger } from "@/utils/log";

@ApplyOptions<InteractionHandler.Options>({
  interactionHandlerType: InteractionHandlerTypes.Button,
})
export class WorkflowApproveButton extends InteractionHandler {
  static build(workflowId: number): ButtonBuilder {
    return new ButtonBuilder()
      .setCustomId(
        `approve-button?${new URLSearchParams({ [customIdParams.workflowId]: String(workflowId) })}`,
      )
      .setLabel("承認して貸し出し")
      .setStyle(ButtonStyle.Success);
  }

  static buildRetry(workflowId: number): ButtonBuilder {
    return new ButtonBuilder()
      .setCustomId(
        `approve-button?${new URLSearchParams({ [customIdParams.workflowId]: String(workflowId) })}`,
      )
      .setLabel("再試行")
      .setStyle(ButtonStyle.Primary);
  }

  public override parse(interaction: ButtonInteraction) {
    if (!interaction.customId.startsWith("approve-button")) return this.none();
    return this.some();
  }

  public override async run(interaction: ButtonInteraction) {
    const [, query] = interaction.customId.split("?");
    const workflowId = Number(
      new URLSearchParams(query).get(customIdParams.workflowId),
    );

    // ワークフロー情報を取得
    const workflow = await workflowService.findById(workflowId);
    if (!workflow) {
      await interaction.reply({
        content: "申請が見つかりませんでした。",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // 未登録のパネルユーザーをチェック
    const unregisteredUsers = workflow.panelUsers
      .filter((user) => !user.registered)
      .map((user) => user.discordId);

    // 未登録ユーザーがいる場合は登録モーダルを表示
    if (unregisteredUsers.length > 0) {
      if (!interaction.guild) {
        await interaction.reply({
          content: "ギルド情報が取得できませんでした。",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const modal = await WorkflowRegisterModal.build(
        String(workflowId),
        unregisteredUsers,
        interaction.guild,
      );
      await interaction.showModal(modal);
      return;
    }

    // 全員登録済みの場合は通常の承認処理を実行
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      await completeApproval(interaction, workflowId);
    } catch (error) {
      logger.error("承認処理中にエラーが発生しました:", error);
      const message =
        error instanceof Error ? error.message : "不明なエラーが発生しました";
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        WorkflowApproveButton.buildRetry(workflowId),
      );
      await interaction.editReply({
        content: `エラーが発生しました: ${message}`,
        components: [row],
      });
    }
  }
}
