import {
  Command,
  RegisterSubCommandGroup,
} from "@kaname-png/plugin-subcommands-advanced";
import { PaginatedMessageEmbedFields } from "@sapphire/discord.js-utilities";
import { workflowService } from "@/domain/services/WorkflowService";
import type { WorkflowStatus } from "@/generated/prisma/client";
import { logger } from "@/utils/log";

@RegisterSubCommandGroup("mcserver-op", "workflow", (builder) =>
  builder
    .setName("list")
    .setDescription("申請一覧を表示")
    .addStringOption((option) =>
      option
        .setName("status")
        .setDescription("表示する申請のステータス")
        .addChoices(
          { name: "承認待ち", value: "PENDING" },
          { name: "却下済み", value: "REJECTED" },
          { name: "貸出中", value: "ACTIVE" },
          { name: "返却済み", value: "RETURNED" },
          { name: "すべて", value: "ALL" },
        )
        .setRequired(false),
    ),
)
export class WorkflowListCommand extends Command {
  public override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction,
  ) {
    await interaction.deferReply();

    try {
      const statusParam = interaction.options.getString("status") ?? "PENDING";

      // ステータスに応じて申請を取得
      const workflows =
        statusParam === "ALL"
          ? await workflowService.findAll()
          : await workflowService.findByStatus(statusParam as WorkflowStatus);

      // ステータス情報を取得
      const statusInfo = this._getStatusInfo(statusParam);

      if (workflows.length === 0) {
        await interaction.editReply(`${statusInfo.label}の申請はありません。`);
        return;
      }

      // PaginatedMessageを使用してページング
      const paginatedMessage = new PaginatedMessageEmbedFields()
        .setTemplate({
          color: statusInfo.color,
          title: `${statusInfo.label}申請一覧`,
          description: `全${workflows.length}件の申請が見つかりました。`,
        })
        .setItems(
          workflows.map((wf) => ({
            name: `ID: ${wf.id} — ${wf.name}`,
            value: [
              `申請者: <@${wf.applicantDiscordId}>`,
              `主催者: <@${wf.organizerDiscordId}>`,
              `パネルユーザー: ${wf.panelUsers.map((u) => `<@${u.discordId}>`).join(", ")}`,
              `バージョン: ${wf.mcVersion ?? "未指定"}`,
              `期間: ${wf.periodDays}日`,
              wf.description ? `補足: ${wf.description}` : "",
            ]
              .filter(Boolean)
              .join("\n"),
            inline: false,
          })),
        )
        .setItemsPerPage(10)
        .make();

      await paginatedMessage.run(interaction);
    } catch (error) {
      logger.error(error);
      const message =
        error instanceof Error ? error.message : "不明なエラーが発生しました";
      await interaction.editReply(`エラーが発生しました: ${message}`);
    }
  }

  /**
   * ステータスに応じた表示情報を取得する
   * @param status ステータス文字列
   * @returns ラベルとカラー情報
   */
  private _getStatusInfo(status: string): { label: string; color: number } {
    switch (status) {
      case "PENDING":
        return { label: "承認待ち", color: 0xf39c12 }; // オレンジ
      case "REJECTED":
        return { label: "却下済み", color: 0xe74c3c }; // 赤
      case "ACTIVE":
        return { label: "貸出中", color: 0x2ecc71 }; // 緑
      case "RETURNED":
        return { label: "返却済み", color: 0x95a5a6 }; // グレー
      case "ALL":
        return { label: "すべて", color: 0x3498db }; // 青
      default:
        return { label: "承認待ち", color: 0xf39c12 };
    }
  }
}
