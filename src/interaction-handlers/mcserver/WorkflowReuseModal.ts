import { ApplyOptions } from "@sapphire/decorators";
import {
  type InteractionHandler,
  InteractionHandlerTypes,
} from "@sapphire/framework";
import type { ModalBuilder, ModalSubmitInteraction } from "discord.js";
import { commandMentions } from "@/discord-utils/commands.js";
import { customIdParams } from "@/discord-utils/customIds";
import { createReuseConfirmation } from "@/domain/flows/ReuseFlow";
import { reuseDraftService } from "@/domain/services/ReuseDraftService";
import { userService } from "@/domain/services/UserService";
import type { BaseWorkflowParams } from "@/domain/services/WorkflowService";
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
export class WorkflowReuseModal extends WorkflowBaseCheckoutModal {
  static build(
    sourceWorkflowId: number,
    defaults?: CheckoutModalDefaults,
  ): ModalBuilder {
    return WorkflowBaseCheckoutModal.buildModal(
      `reuse-modal?${new URLSearchParams({
        [customIdParams.sourceWorkflowId]: String(sourceWorkflowId),
      })}`,
      "サーバー流用",
      defaults,
    );
  }

  public override parse(interaction: ModalSubmitInteraction) {
    if (!interaction.customId.startsWith("reuse-modal")) return this.none();
    return this.some();
  }

  protected override async execute(
    interaction: ModalSubmitInteraction,
    fields: BaseWorkflowParams,
  ): Promise<void> {
    // /mcserver が使える人のみ流用できる
    const isGeneral =
      interaction.inCachedGuild() &&
      (await commandMentions.mcserver.checkPermission(interaction.member));
    if (!isGeneral) {
      await interaction.editReply("この操作を実行する権限がありません。");
      return;
    }

    const [, query] = interaction.customId.split("?");
    const sourceWorkflowId = Number(
      new URLSearchParams(query).get(customIdParams.sourceWorkflowId),
    );

    if (Number.isNaN(sourceWorkflowId)) {
      await interaction.editReply(
        "エラー: 流用元申請IDが見つかりませんでした。",
      );
      return;
    }

    try {
      const sourceWorkflow = await workflowService.findById(sourceWorkflowId);
      if (!sourceWorkflow || !sourceWorkflow.pteroServerId) {
        await interaction.editReply("流用元の申請が見つかりませんでした。");
        return;
      }

      if (sourceWorkflow.status !== WorkflowStatus.ACTIVE) {
        await interaction.editReply("この申請は現在流用できません。");
        return;
      }

      if (sourceWorkflow.organizerDiscordId !== interaction.user.id) {
        await interaction.editReply("この申請を流用する権限がありません。");
        return;
      }

      // 承認フローを通さないので、流用時に追加されるパネルユーザーは全員登録済みが必須。
      const panelUsers = await userService.findByDiscordIds(fields.panelUsers);
      const registeredIds = new Set(
        panelUsers
          .filter((user) => user.registered && user.email)
          .map((user) => user.discordId),
      );
      const unregisteredIds = fields.panelUsers.filter(
        (discordId) => !registeredIds.has(discordId),
      );

      if (unregisteredIds.length > 0) {
        const registerCommand = interaction.guildId
          ? commandMentions.mcserverOpUserRegister.resolve(interaction.guildId)
          : "/mcserver-op user register";
        await interaction.editReply(
          `未登録のパネルユーザーが含まれています: ${unregisteredIds
            .map((id) => `<@${id}>`)
            .join(", ")}\n` +
            `流用では未登録ユーザーを追加できません。管理者に ${registerCommand} を依頼してください。`,
        );
        return;
      }

      const token = reuseDraftService.create({
        sourceWorkflowId,
        applicantDiscordId: interaction.user.id,
        organizerDiscordId: sourceWorkflow.organizerDiscordId,
        fields,
      });

      const { embed, row } = await createReuseConfirmation(
        sourceWorkflowId,
        token,
      );
      await interaction.editReply({ embeds: [embed], components: [row] });
    } catch (error) {
      logger.error("流用確認の準備中にエラーが発生しました:", error);
      const message =
        error instanceof Error ? error.message : "不明なエラーが発生しました";
      await interaction.editReply(
        `流用確認の準備中にエラーが発生しました: ${message}`,
      );
    }
  }
}
