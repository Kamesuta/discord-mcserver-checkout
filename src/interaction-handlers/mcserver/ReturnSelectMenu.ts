import { ApplyOptions } from "@sapphire/decorators";
import {
  InteractionHandler,
  InteractionHandlerTypes,
} from "@sapphire/framework";
import { MessageFlags, type StringSelectMenuInteraction } from "discord.js";
import { commandMentions } from "@/discord-utils/commands.js";
import { createReturnConfirmation } from "@/domain/flows/ReturnFlow";
import { workflowService } from "@/domain/services/WorkflowService";
import { WorkflowStatus } from "@/generated/prisma/client";
import { logger } from "@/utils/log";

/**
 * 返却申請選択セレクトメニューのハンドラー
 */
@ApplyOptions<InteractionHandler.Options>({
  interactionHandlerType: InteractionHandlerTypes.SelectMenu,
})
export class ReturnSelectMenu extends InteractionHandler {
  public override parse(interaction: StringSelectMenuInteraction) {
    if (!interaction.customId.startsWith("return-select-menu"))
      return this.none();
    return this.some();
  }

  public override async run(interaction: StringSelectMenuInteraction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    // /mcserver が使える人のみ返却できる
    const isGeneral =
      interaction.inCachedGuild() &&
      (await commandMentions.mcserver.checkPermission(interaction.member));
    if (!isGeneral) {
      await interaction.editReply("この操作を実行する権限がありません。");
      return;
    }

    try {
      const workflowId = Number(interaction.values[0]);
      const skipReset = false;
      const skipArchive = false;

      const workflow = await workflowService.findById(workflowId);
      if (!workflow) {
        await interaction.editReply("申請が見つかりませんでした。");
        return;
      }

      if (
        workflow.status !== WorkflowStatus.ACTIVE ||
        !workflow.pteroServerId
      ) {
        await interaction.editReply(
          "この申請は ACTIVE ではありません。返却できません。",
        );
        return;
      }

      // /mcserver-op が使える人は全サーバーの返却ボタンを押せる
      const isOp =
        interaction.inCachedGuild() &&
        (await commandMentions.mcserverOp.checkPermission(interaction.member));

      // 権限チェック
      if (
        !isOp &&
        workflow.organizerDiscordId !== interaction.user.id &&
        !workflow.panelUsers.some((u) => u.discordId === interaction.user.id)
      ) {
        await interaction.editReply("この申請を返却する権限がありません。");
        return;
      }

      // 共通の返却確認Embed・ボタンを作成
      const { embed, row } = await createReturnConfirmation(
        workflow,
        skipReset,
        skipArchive,
      );
      await interaction.editReply({ embeds: [embed], components: [row] });
    } catch (error) {
      logger.error("返却選択メニュー処理中にエラーが発生しました:", error);
      const message =
        error instanceof Error ? error.message : "不明なエラーが発生しました";
      await interaction.editReply(`エラーが発生しました: ${message}`);
    }
  }
}
