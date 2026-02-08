import { ApplyOptions } from "@sapphire/decorators";
import {
  InteractionHandler,
  InteractionHandlerTypes,
} from "@sapphire/framework";
import {
  ActionRowBuilder,
  type ButtonBuilder,
  EmbedBuilder,
  MessageFlags,
  type StringSelectMenuInteraction,
} from "discord.js";
import { commandMentions } from "@/discord-utils/commands.js";
import { pterodactylBackupService } from "@/domain/services/pterodactyl/PterodactylBackupService";
import { serverBindingService } from "@/domain/services/ServerBindingService";
import { workflowService } from "@/domain/services/WorkflowService";
import { workflowFields } from "@/domain/utils/workflowFields";
import { WorkflowStatus } from "@/generated/prisma/client";
import { ReturnConfirmButton } from "@/interaction-handlers/return/ReturnBackupSelect";
import { logger } from "@/utils/log";

/**
 * バイトサイズを人間が読みやすい形式に変換する
 */
function formatSize(bytes: number): string {
  const kb = bytes / 1024;
  if (kb >= 1024) {
    return `${(kb / 1024).toFixed(1)} MB`;
  }
  return `${Math.ceil(kb)} KB`;
}

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
      const isAdmin =
        interaction.inCachedGuild() &&
        (await commandMentions.mcserverOp.checkPermission(interaction.member));

      // 権限チェック
      if (
        !isAdmin &&
        workflow.organizerDiscordId !== interaction.user.id &&
        !workflow.panelUsers.some((u) => u.discordId === interaction.user.id)
      ) {
        await interaction.editReply("この申請を返却する権限がありません。");
        return;
      }

      // ロック済みバックアップ一覧取得（情報表示用）
      const backups = await pterodactylBackupService.listBackups(
        workflow.pteroServerId,
      );
      const locked = backups.filter((b) => b.attributes.is_locked);

      // サーバーのバインディング名を取得
      const serverName = await serverBindingService.getName(
        workflow.pteroServerId,
      );

      // Embed 作成
      const embed = new EmbedBuilder()
        .setColor(0xe74c3c)
        .setTitle(`「${serverName}」返却`)
        .addFields(...workflowFields({ ...workflow, serverName }));

      // ロック済みバックアップ一覧（アーカイブ対象）
      if (locked.length > 0) {
        embed.addFields({
          name: "追加アーカイブ対象（ロック済みバックアップ）",
          value: locked
            .map(
              (b) =>
                `🔒 ${b.attributes.name} (${formatSize(b.attributes.bytes)})`,
            )
            .join("\n"),
        });
      }

      // 確認ボタン
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        ReturnConfirmButton.build(workflow.id, skipReset, skipArchive),
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
