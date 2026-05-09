import {
  Command,
  RegisterSubCommandGroup,
} from "@kaname-png/plugin-subcommands-advanced";
import { MessageFlags } from "discord.js";
import { reminderMessageService } from "@/domain/services/ReminderMessageService";
import { serverBindingService } from "@/domain/services/ServerBindingService";
import { workflowService } from "@/domain/services/WorkflowService";
import { workflowAutocomplete } from "@/domain/utils/workflowAutocomplete";
import { WorkflowStatus } from "@/generated/prisma/client";
import { parseDate } from "@/utils/dateParser";
import { logger } from "@/utils/log";

@RegisterSubCommandGroup("mcserver-op", "checkout", (builder) =>
  builder
    .setName("extend")
    .setDescription("貸出期限を変更する")
    .addIntegerOption((option) =>
      option
        .setName("id")
        .setDescription("申請ID")
        .setRequired(true)
        .setAutocomplete(true),
    )
    .addStringOption((option) =>
      option
        .setName("date")
        .setDescription("日付 (YYYY/MM/DD)")
        .setRequired(true),
    ),
)
export class CheckoutExtendCommand extends Command {
  public override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction,
  ) {
    const id = interaction.options.getInteger("id", true);
    const dateStr = interaction.options.getString("date", true);

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

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
          if (!workflow.endDate) {
            await interaction.editReply(
              "この申請には現在の終了日がありません。期限変更はできません。",
            );
            return;
          }

          const oldEndDate = new Date(workflow.endDate);
          await workflowService.updateEndDate(id, targetDate);

          // 延長・期限変更できたら、既存の催促通知を消して代わりに変更結果を通知する
          await reminderMessageService.deleteByWorkflowId(
            interaction.client,
            id,
          );

          const serverName = workflow.pteroServerId
            ? await serverBindingService.getName(workflow.pteroServerId)
            : undefined;
          await reminderMessageService.sendExtensionNotification(
            interaction.client,
            workflow,
            oldEndDate,
            targetDate,
            interaction.user.id,
            serverName,
          );

          await interaction.editReply(
            `申請 (ID: \`${id}\`) の終了日を <t:${Math.floor(targetDate.getTime() / 1000)}:D> に更新しました。`,
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

  public override async autocompleteRun(
    interaction: Command.AutocompleteInteraction,
  ) {
    await workflowAutocomplete(interaction, [
      WorkflowStatus.PENDING,
      WorkflowStatus.ACTIVE,
    ]);
  }
}
