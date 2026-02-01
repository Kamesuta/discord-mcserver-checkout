import {
  InteractionHandler,
  InteractionHandlerTypes,
} from "@sapphire/framework";
import type { ModalSubmitInteraction } from "discord.js";
import semver from "semver";
import { workflowService } from "../domain/services/WorkflowService.js";
import { logger } from "../utils/log.js";

export class CheckoutModalHandler extends InteractionHandler {
  public constructor(
    context: InteractionHandler.LoaderContext,
    options: InteractionHandler.Options,
  ) {
    super(context, {
      ...options,
      interactionHandlerType: InteractionHandlerTypes.ModalSubmit,
    });
  }

  public override parse(interaction: ModalSubmitInteraction) {
    if (!interaction.customId.startsWith("checkout_modal")) return this.none();
    return this.some();
  }

  public override async run(interaction: ModalSubmitInteraction) {
    await interaction.deferReply();

    const name = interaction.fields.getTextInputValue("name");
    const description = interaction.fields.getTextInputValue("description");
    const mcVersion = interaction.fields.getTextInputValue("mc_version");
    const periodStr = interaction.fields.getTextInputValue("period");

    // customId: checkout_modal?organizerId=...
    const [_path, query] = interaction.customId.split("?");
    const organizerId = new URLSearchParams(query).get("organizerId");

    if (!organizerId) {
      await interaction.editReply("エラー: 主催者IDが見つかりませんでした。");
      return;
    }

    // Panel Users取得 (UserSelectMenu)
    // ModalSubmitInteractionからSelectMenuの値を取得する
    const panelUsersField = interaction.fields.fields.get("panel_users");
    const panelUsers =
      panelUsersField && "values" in panelUsersField
        ? (panelUsersField.values as string[])
        : [];

    // バリデーション
    if (mcVersion && !semver.valid(mcVersion)) {
      await interaction.editReply(
        "Minecraft バージョンの形式が正しくありません (例: 1.20.1)。空の場合は最新版が適用されます。",
      );
      return;
    }

    const period = Number.parseInt(periodStr, 10);
    if (Number.isNaN(period) || period <= 0) {
      await interaction.editReply("貸出期間は正の整数で入力してください。");
      return;
    }

    if (panelUsers.length === 0) {
      await interaction.editReply(
        "パネル権限付与対象ユーザーを1人以上指定してください。",
      );
      return;
    }

    try {
      const workflow = await workflowService.create({
        name,
        description: description || undefined,
        mcVersion: mcVersion || undefined,
        periodDays: period,
        applicantDiscordId: interaction.user.id,
        organizerDiscordId: organizerId,
        panelUsers,
      });

      await interaction.editReply({
        content: `申請を受け付けました！\n申請ID: \`${workflow.id}\`\n管理者の承認をお待ちください。`,
      });
    } catch (error) {
      logger.error("申請作成中にエラーが発生しました:", error);
      await interaction.editReply("申請の保存中にエラーが発生しました。");
    }
  }
}
