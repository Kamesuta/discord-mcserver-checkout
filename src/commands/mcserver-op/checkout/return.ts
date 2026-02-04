import {
  Command,
  RegisterSubCommandGroup,
} from "@kaname-png/plugin-subcommands-advanced";
import {
  ActionRowBuilder,
  type ButtonBuilder,
  EmbedBuilder,
  MessageFlags,
} from "discord.js";
import { pterodactylBackupService } from "@/domain/services/pterodactyl/PterodactylBackupService";
import { serverBindingService } from "@/domain/services/ServerBindingService";
import { workflowService } from "@/domain/services/WorkflowService";
import { workflowAutocomplete } from "@/domain/utils/workflowAutocomplete";
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

@RegisterSubCommandGroup("mcserver-op", "checkout", (builder) =>
  builder
    .setName("return")
    .setDescription("サーバーを返却する")
    .addIntegerOption((option) =>
      option
        .setName("id")
        .setDescription("申請ID")
        .setRequired(true)
        .setAutocomplete(true),
    )
    .addBooleanOption((option) =>
      option
        .setName("skip-reset")
        .setDescription("サーバーリセット（全ファイル削除）をスキップする")
        .setRequired(false),
    )
    .addBooleanOption((option) =>
      option
        .setName("skip-archive")
        .setDescription("アーカイブ処理をスキップする")
        .setRequired(false),
    ),
)
export class CheckoutReturnCommand extends Command {
  public override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction,
  ) {
    const id = interaction.options.getInteger("id", true);
    const skipReset = interaction.options.getBoolean("skip-reset") ?? false;
    const skipArchive = interaction.options.getBoolean("skip-archive") ?? false;
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      const workflow = await workflowService.findById(id);
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

      // ロック済みバックアップ一覧取得（情報表示用）
      const backups = await pterodactylBackupService.listBackups(
        workflow.pteroServerId,
      );
      const locked = backups.filter((b) => b.attributes.is_locked);

      // サーバーのバインディング名を取得
      const serverName = await serverBindingService.getName(
        workflow.pteroServerId,
      );

      const endDateStr = workflow.endDate
        ? `<t:${Math.floor(workflow.endDate.getTime() / 1000)}:R>`
        : "未設定";

      // Embed 作成
      const embed = new EmbedBuilder()
        .setColor(0xe74c3c)
        .setTitle(`「${serverName}」返却`)
        .addFields(
          { name: "主催者", value: `<@${workflow.organizerDiscordId}>` },
          { name: "申請ID", value: workflow.id.toString(), inline: true },
          { name: "企画", value: workflow.name, inline: true },
          { name: "期限", value: endDateStr, inline: true },
        );

      if (skipArchive && !skipReset) {
        embed.addFields({
          name: "⚠️データ消失注意",
          value:
            "バックアップを取らず**初期化されます**！\n十分注意してください！",
        });
      }
      if (skipArchive || skipReset) {
        const warnMessages: string[] = [];
        if (skipArchive) {
          warnMessages.push("- バックアップtar.gzは作成されません");
        }
        if (skipReset) {
          warnMessages.push("- 初期化はされません");
        }
        embed.addFields({
          name: "スキップ",
          value: warnMessages.join("\n"),
        });
      }

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
      logger.error(error);
      const message =
        error instanceof Error ? error.message : "不明なエラーが発生しました";
      await interaction.editReply(`エラーが発生しました: ${message}`);
    }
  }

  public override async autocompleteRun(
    interaction: Command.AutocompleteInteraction,
  ) {
    await workflowAutocomplete(interaction, [WorkflowStatus.ACTIVE]);
  }
}
