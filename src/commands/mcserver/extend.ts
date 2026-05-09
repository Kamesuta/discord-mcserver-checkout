import {
  Command,
  RegisterSubCommand,
} from "@kaname-png/plugin-subcommands-advanced";
import { MessageFlags } from "discord.js";
import { reminderMessageService } from "@/domain/services/ReminderMessageService";
import { serverBindingService } from "@/domain/services/ServerBindingService";
import { workflowService } from "@/domain/services/WorkflowService";
import { WorkflowStatus } from "@/generated/prisma/client";
import env from "@/utils/env.js";
import { logger } from "@/utils/log";

@RegisterSubCommand("mcserver", (builder) =>
  builder
    .setName("extend")
    .setDescription(`サーバー貸出期限を${env.CHECKOUT_EXTEND_DAYS}日延長する`),
)
export class McServerExtendCommand extends Command {
  public override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction,
  ) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      // ユーザーが主催者のACTIVEな申請を検索
      const activeWorkflows = await workflowService.findByStatus(
        WorkflowStatus.ACTIVE,
      );
      const userWorkflow = activeWorkflows.find(
        (w) => w.organizerDiscordId === interaction.user.id && w.endDate,
      );

      if (!userWorkflow) {
        await interaction.editReply(
          "あなたが主催者の貸出中のサーバーが見つかりませんでした。",
        );
        return;
      }

      if (!userWorkflow.endDate) {
        await interaction.editReply("貸出期限が設定されていません。");
        return;
      }

      // 環境変数で指定した日数だけ延長する
      const currentEndDate = new Date(userWorkflow.endDate);
      const newEndDate = new Date(
        currentEndDate.getTime() +
          env.CHECKOUT_EXTEND_DAYS * 24 * 60 * 60 * 1000,
      );

      await workflowService.updateEndDate(userWorkflow.id, newEndDate);

      // サーバーのバインディング名を取得
      const serverName = userWorkflow.pteroServerId
        ? await serverBindingService.getName(userWorkflow.pteroServerId)
        : null;

      // 延長できたら、既存の催促通知を消して代わりに延長結果を通知する
      await reminderMessageService.deleteByWorkflowId(
        interaction.client,
        userWorkflow.id,
      );

      await interaction.editReply(
        `「${userWorkflow.name}」(ID: ${userWorkflow.id})のサーバー貸出を${env.CHECKOUT_EXTEND_DAYS}日延長しました。\n\n` +
          `申請ID: ${userWorkflow.id}\n` +
          `企画: ${userWorkflow.name}\n` +
          `サーバー: \`${serverName ?? userWorkflow.pteroServerId ?? "未割り当て"}\`\n` +
          `新しい期限: <t:${Math.floor(newEndDate.getTime() / 1000)}:D>`,
      );

      await reminderMessageService.sendExtensionNotification(
        interaction.client,
        userWorkflow,
        currentEndDate,
        newEndDate,
        interaction.user.id,
        serverName,
      );

      logger.info(
        `Workflow ${userWorkflow.id} extended by ${interaction.user.id} (${interaction.user.tag}) via command`,
      );
    } catch (error) {
      logger.error(error);
      const message =
        error instanceof Error ? error.message : "不明なエラーが発生しました";
      await interaction.editReply(`エラーが発生しました: ${message}`);
    }
  }
}
