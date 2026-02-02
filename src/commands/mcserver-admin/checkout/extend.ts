import {
  Command,
  RegisterSubCommandGroup,
} from "@kaname-png/plugin-subcommands-advanced";
import { workflowService } from "@/domain/services/WorkflowService.js";
import { WorkflowStatus } from "@/generated/prisma/client.js";
import { parseDate } from "@/utils/dateParser.js";
import { logger } from "@/utils/log.js";

@RegisterSubCommandGroup("mcserver-admin", "checkout", (builder) =>
  builder
    .setName("extend")
    .setDescription("貸出期限を変更する")
    .addIntegerOption((option) =>
      option.setName("id").setDescription("申請ID").setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("date")
        .setDescription("日付 (YYYY/MM/DD)")
        .setRequired(true),
    ),
)
export class McServerAdminCheckoutExtendCommand extends Command {
  public override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction,
  ) {
    const id = interaction.options.getInteger("id", true);
    const dateStr = interaction.options.getString("date", true);

    await interaction.deferReply();

    try {
      // 日付パース
      const targetDate = parseDate(dateStr);
      if (!targetDate) {
        await interaction.editReply(
          "日付の形式が正しくありません。`YYYY/MM/DD` または `MM/DD` で入力してください。",
        );
        return;
      }

      const workflow = await workflowService.findById(id);
      if (!workflow) {
        await interaction.editReply("申請が見つかりませんでした。");
        return;
      }

      switch (workflow.status) {
        case WorkflowStatus.PENDING: {
          const now = new Date();
          const periodDays = Math.ceil(
            (targetDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000),
          );
          if (periodDays < 0) {
            await interaction.editReply(
              "指定した日付は今日より前です。将来の日付を入力してください。",
            );
            return;
          }
          await workflowService.updatePeriodDays(id, periodDays);
          await interaction.editReply(
            `申請 (ID: \`${id}\`) の貸出期間を \`${periodDays}日\` に更新しました。`,
          );
          break;
        }
        case WorkflowStatus.ACTIVE: {
          await workflowService.updateEndDate(id, targetDate);
          await interaction.editReply(
            `申請 (ID: \`${id}\`) の終了日を \`${targetDate.toLocaleDateString("ja-JP")}\` に更新しました。`,
          );
          break;
        }
        default: {
          await interaction.editReply(
            `ステータス \`${workflow.status}\` の申請では期限変更はできません。`,
          );
          break;
        }
      }
    } catch (error) {
      logger.error(error);
      const message =
        error instanceof Error ? error.message : "不明なエラーが発生しました";
      await interaction.editReply(`エラーが発生しました: ${message}`);
    }
  }
}
