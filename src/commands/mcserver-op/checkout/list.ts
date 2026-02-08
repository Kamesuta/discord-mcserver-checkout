import {
  Command,
  RegisterSubCommandGroup,
} from "@kaname-png/plugin-subcommands-advanced";
import { EmbedBuilder, MessageFlags } from "discord.js";
import { GanttChart } from "@/discord-utils/GanttChart";
import { serverBindingService } from "@/domain/services/ServerBindingService";
import { workflowService } from "@/domain/services/WorkflowService";
import { WorkflowStatus } from "@/generated/prisma/client";
import { logger } from "@/utils/log";

@RegisterSubCommandGroup("mcserver-op", "checkout", (builder) =>
  builder.setName("list").setDescription("貸出中サーバー一覧を表示"),
)
export class CheckoutListCommand extends Command {
  public override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction,
  ) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      const workflows = await workflowService.findByStatus(
        WorkflowStatus.ACTIVE,
      );

      if (workflows.length === 0) {
        await interaction.editReply("貸出中のサーバーはありません。");
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle("貸出中サーバー一覧")
        .setColor(0x3498db);
      const servers: string[] = [];

      // ガントチャートの表示期間を設定（過去4日〜未来12日）
      const today = new Date();
      const startRange = new Date(today);
      startRange.setDate(startRange.getDate() - 4);
      const endRange = new Date(today);
      endRange.setDate(endRange.getDate() + 12);

      const ganttChart = new GanttChart(startRange, endRange, today);
      let hasGanttData = false;

      for (const wf of workflows) {
        // サーバーのバインディング名を取得
        const serverName = wf.pteroServerId
          ? await serverBindingService.getName(wf.pteroServerId)
          : null;

        const endDateText = wf.endDate
          ? `<t:${Math.floor(wf.endDate.getTime() / 1000)}:R>`
          : "未設定";
        servers.push(
          `- ${serverName}: ${endDateText}「${wf.name}」(ID:${wf.id},主催:<@${wf.organizerDiscordId}>)`,
        );

        // ガントチャート用データを追加
        if (wf.startDate && wf.endDate && serverName) {
          ganttChart.addTask({
            id: wf.id.toString(),
            name: serverName,
            start: wf.startDate,
            end: wf.endDate,
          });
          hasGanttData = true;
        }
      }

      embed.setDescription(servers.join("\n"));

      // ガントチャートをレンダリング
      const ganttChartText = hasGanttData
        ? `\`\`\`\n${ganttChart.render()}\`\`\``
        : undefined;

      await interaction.editReply({
        embeds: [embed],
        content: ganttChartText,
      });
    } catch (error) {
      logger.error(error);
      const message =
        error instanceof Error ? error.message : "不明なエラーが発生しました";
      await interaction.editReply(`エラーが発生しました: ${message}`);
    }
  }
}
