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
import { serverBindingService } from "@/domain/services/ServerBindingService";
import { workflowService } from "@/domain/services/WorkflowService";
import { WorkflowStatus } from "@/generated/prisma/client";
import { logger } from "@/utils/log";

/**
 * 全部確認ボードの「流用する」ボタンハンドラー
 */
@ApplyOptions<InteractionHandler.Options>({
  interactionHandlerType: InteractionHandlerTypes.Button,
})
export class ReuseRequestButton extends InteractionHandler {
  /**
   * 流用ボタンを作成
   */
  static build(): ButtonBuilder {
    return new ButtonBuilder()
      .setCustomId("reuse-request-button")
      .setLabel("サーバーを流用する")
      .setStyle(ButtonStyle.Primary);
  }

  public override parse(interaction: ButtonInteraction) {
    if (!interaction.customId.startsWith("reuse-request-button"))
      return this.none();
    return this.some();
  }

  public override async run(interaction: ButtonInteraction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    // /mcserver が使える人のみ流用できる
    const isGeneral =
      interaction.inCachedGuild() &&
      (await commandMentions.mcserver.checkPermission(interaction.member));
    if (!isGeneral) {
      await interaction.editReply("この操作を実行する権限がありません。");
      return;
    }

    try {
      // 流用は主催者本人のみ許可する
      const workflows = await workflowService.findByStatus(
        WorkflowStatus.ACTIVE,
      );
      const userWorkflows = workflows.filter(
        (workflow) => workflow.organizerDiscordId === interaction.user.id,
      );

      if (userWorkflows.length === 0) {
        await interaction.editReply(
          "流用可能な申請がありません。\n（あなたが主催者の貸出中申請のみ流用できます）",
        );
        return;
      }

      const options: StringSelectMenuOptionBuilder[] = [];
      for (const workflow of userWorkflows) {
        const serverName = workflow.pteroServerId
          ? await serverBindingService.getName(workflow.pteroServerId)
          : undefined;

        options.push(
          new StringSelectMenuOptionBuilder()
            .setLabel(`${serverName ?? "未割当"} - ${workflow.name}`)
            .setDescription(`ID: ${workflow.id}`)
            .setValue(workflow.id.toString()),
        );
      }

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId("reuse-select-menu")
        .setPlaceholder("流用する申請を選択してください")
        .addOptions(options);

      const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        selectMenu,
      );

      await interaction.editReply({
        content:
          "流用とは、申請済みのサーバーを追加の申請なしに別の企画へ転用できる機能です。\n" +
          "サーバーがバックアップされ、リセットされたうえで新しい企画に引き継がれます。\n" +
          "企画ごとのバックアップを確実に残すためにも、企画を切り替えるときはこの機能を使ってください。\n\n" +
          "流用する申請を選択してください：",
        components: [row],
      });
    } catch (error) {
      logger.error("流用ボタン処理中にエラーが発生しました:", error);
      const message =
        error instanceof Error ? error.message : "不明なエラーが発生しました";
      await interaction.editReply(`エラーが発生しました: ${message}`);
    }
  }
}
