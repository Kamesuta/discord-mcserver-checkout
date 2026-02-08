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
import { serverBindingService } from "@/domain/services/ServerBindingService";
import { workflowService } from "@/domain/services/WorkflowService";
import { WorkflowStatus } from "@/generated/prisma/client";
import { logger } from "@/utils/log";

/**
 * 全部確認ボードの「返却する」ボタンハンドラー
 */
@ApplyOptions<InteractionHandler.Options>({
  interactionHandlerType: InteractionHandlerTypes.Button,
})
export class ReturnRequestButton extends InteractionHandler {
  /**
   * 返却ボタンを作成
   */
  static build(): ButtonBuilder {
    return new ButtonBuilder()
      .setCustomId("return-request-button")
      .setLabel("サーバーを返却する")
      .setStyle(ButtonStyle.Danger);
  }

  public override parse(interaction: ButtonInteraction) {
    if (!interaction.customId.startsWith("return-request-button"))
      return this.none();
    return this.some();
  }

  public override async run(interaction: ButtonInteraction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      // ユーザーが主催者またはパネルユーザーのACTIVE申請を取得
      const workflows = await workflowService.findByStatus(
        WorkflowStatus.ACTIVE,
      );

      const userWorkflows = workflows.filter(
        (wf) => wf.organizerDiscordId === interaction.user.id,
      );

      if (userWorkflows.length === 0) {
        await interaction.editReply(
          "返却可能な申請がありません。\n（あなたが主催者の貸出中申請のみ返却できます）",
        );
        return;
      }

      // セレクトメニューを作成
      const options: StringSelectMenuOptionBuilder[] = [];

      for (const wf of userWorkflows) {
        const serverName = wf.pteroServerId
          ? await serverBindingService.getName(wf.pteroServerId)
          : undefined;

        const endDateText = wf.endDate
          ? `期限: ${new Date(wf.endDate).toLocaleDateString()}`
          : "期限未設定";

        options.push(
          new StringSelectMenuOptionBuilder()
            .setLabel(`${serverName ?? "未割当"} - ${wf.name}`)
            .setDescription(`ID: ${wf.id}, ${endDateText}`)
            .setValue(wf.id.toString()),
        );
      }

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId("return-select-menu")
        .setPlaceholder("返却する申請を選択してください")
        .addOptions(options);

      const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        selectMenu,
      );

      await interaction.editReply({
        content: "返却する申請を選択してください：",
        components: [row],
      });
    } catch (error) {
      logger.error("返却ボタン処理中にエラーが発生しました:", error);
      const message =
        error instanceof Error ? error.message : "不明なエラーが発生しました";
      await interaction.editReply(`エラーが発生しました: ${message}`);
    }
  }
}
