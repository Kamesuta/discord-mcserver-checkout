import { ApplyOptions } from "@sapphire/decorators";
import {
  InteractionHandler,
  InteractionHandlerTypes,
} from "@sapphire/framework";
import { MessageFlags, type StringSelectMenuInteraction } from "discord.js";
import { commandMentions } from "@/discord-utils/commands.js";
import { workflowService } from "@/domain/services/WorkflowService";
import { formatMcVersionInput } from "@/domain/utils/serverType";
import { WorkflowStatus } from "@/generated/prisma/client";
import { WorkflowReuseModal } from "@/interaction-handlers/mcserver/WorkflowReuseModal";
import { logger } from "@/utils/log";

/**
 * 流用対象選択セレクトメニューのハンドラー
 */
@ApplyOptions<InteractionHandler.Options>({
  interactionHandlerType: InteractionHandlerTypes.SelectMenu,
})
export class ReuseSelectMenu extends InteractionHandler {
  public override parse(interaction: StringSelectMenuInteraction) {
    if (!interaction.customId.startsWith("reuse-select-menu"))
      return this.none();
    return this.some();
  }

  public override async run(interaction: StringSelectMenuInteraction) {
    // /mcserver が使える人のみ流用できる
    const isGeneral =
      interaction.inCachedGuild() &&
      (await commandMentions.mcserver.checkPermission(interaction.member));
    if (!isGeneral) {
      await interaction.reply({
        content: "この操作を実行する権限がありません。",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    try {
      const workflowId = Number(interaction.values[0]);
      const workflow = await workflowService.findById(workflowId);
      if (!workflow) {
        await interaction.reply({
          content: "申請が見つかりませんでした。",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      if (
        workflow.status !== WorkflowStatus.ACTIVE ||
        !workflow.pteroServerId
      ) {
        await interaction.reply({
          content: "この申請は ACTIVE ではありません。流用できません。",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      if (workflow.organizerDiscordId !== interaction.user.id) {
        await interaction.reply({
          content: "この申請を流用する権限がありません。",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const modal = WorkflowReuseModal.build(workflow.id, {
        name: workflow.name,
        mcVersion: formatMcVersionInput(
          workflow.mcVersion,
          workflow.serverType,
        ),
        description: workflow.description ?? undefined,
      });

      await interaction.showModal(modal);
    } catch (error) {
      logger.error("流用選択メニュー処理中にエラーが発生しました:", error);
      const message =
        error instanceof Error ? error.message : "不明なエラーが発生しました";
      await interaction.reply({
        content: `エラーが発生しました: ${message}`,
        flags: MessageFlags.Ephemeral,
      });
    }
  }
}
