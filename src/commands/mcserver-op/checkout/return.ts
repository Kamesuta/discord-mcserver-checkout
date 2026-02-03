import {
  Command,
  RegisterSubCommandGroup,
} from "@kaname-png/plugin-subcommands-advanced";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from "discord.js";
import { pterodactylBackupService } from "@/domain/services/pterodactyl/PterodactylBackupService";
import { serverBindingService } from "@/domain/services/ServerBindingService";
import { workflowService } from "@/domain/services/WorkflowService";
import { workflowAutocomplete } from "@/domain/utils/workflowAutocomplete";
import { WorkflowStatus } from "@/generated/prisma/client";
import { logger } from "@/utils/log";

/**
 * バイトサイズを人間が読みやすい形式に変換する
 */
function formatSize(bytes: number): string {
  const kb = bytes / 1024;
  if (kb >= 1024) {
    return `${(kb / 1024).toFixed(1)} MB`;
  }
  return `${Math.round(kb)} KB`;
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
    await interaction.deferReply();

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

      // Embed 作成
      const embed = new EmbedBuilder()
        .setTitle(`返却 — ID: ${workflow.id} — ${workflow.name}`)
        .setColor(0xe74c3c)
        .addFields(
          { name: "主催者", value: `<@${workflow.organizerDiscordId}>` },
          {
            name: "パネルユーザー",
            value: workflow.panelUsers
              .map((u) => `<@${u.discordId}>`)
              .join(", "),
          },
          {
            name: "サーバー",
            value: `\`${serverName ?? workflow.pteroServerId}\``,
          },
          {
            name: "期限",
            value: workflow.endDate?.toLocaleDateString("ja-JP") ?? "未設定",
          },
        );

      // ロック済みバックアップ一覧（アーカイブ対象）
      if (locked.length > 0) {
        embed.addFields({
          name: "アーカイブ対象（ロック済みバックアップ）",
          value: locked
            .map(
              (b) =>
                `🔒 ${b.attributes.name} (${formatSize(b.attributes.size)})`,
            )
            .join("\n"),
        });
      }

      embed.addFields({
        name: "アーカイブ処理",
        value:
          "ロック済みバックアップと最新ファイル状態（一時バックアップ）を" +
          "アーカイブし、ロック済みバックアップのロックを解除します。",
      });

      // 確認ボタン
      const params = new URLSearchParams({
        workflowId: String(workflow.id),
        skipReset: skipReset.toString(),
        skipArchive: skipArchive.toString(),
      });
      const button = new ButtonBuilder()
        .setCustomId(`return-confirm?${params.toString()}`)
        .setLabel("返却を実行")
        .setStyle(ButtonStyle.Danger);

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button);
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
