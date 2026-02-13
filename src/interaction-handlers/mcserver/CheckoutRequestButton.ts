import { ApplyOptions } from "@sapphire/decorators";
import {
  InteractionHandler,
  InteractionHandlerTypes,
} from "@sapphire/framework";
import {
  ButtonBuilder,
  type ButtonInteraction,
  ButtonStyle,
  MessageFlags,
} from "discord.js";
import { commandMentions } from "@/discord-utils/commands.js";
import { WorkflowCreateModal } from "@/interaction-handlers/mcserver/WorkflowCreateModal";

/**
 * 全部確認ボードの「申請する」ボタンハンドラー
 */
@ApplyOptions<InteractionHandler.Options>({
  interactionHandlerType: InteractionHandlerTypes.Button,
})
export class CheckoutRequestButton extends InteractionHandler {
  /**
   * 申請ボタンを作成
   */
  static build(): ButtonBuilder {
    return new ButtonBuilder()
      .setCustomId("checkout-request-button")
      .setLabel("新規サーバー貸し出し申請する")
      .setStyle(ButtonStyle.Success);
  }

  public override parse(interaction: ButtonInteraction) {
    if (!interaction.customId.startsWith("checkout-request-button"))
      return this.none();
    return this.some();
  }

  public override async run(interaction: ButtonInteraction) {
    // /mcserver が使える人のみ申請できる
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

    // 申請者自身を主催者としてモーダルを表示
    const modal = WorkflowCreateModal.build(interaction.user.id, {
      panelUsers: [interaction.user.id],
    });
    await interaction.showModal(modal);
  }
}
