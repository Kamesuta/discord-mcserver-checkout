import {
  Command,
  RegisterSubCommandGroup,
} from "@kaname-png/plugin-subcommands-advanced";
import { EmbedBuilder } from "discord.js";
import { serverBindingService } from "@/domain/services/ServerBindingService";
import { workflowService } from "@/domain/services/WorkflowService";
import { WorkflowStatus } from "@/generated/prisma/client";
import { logger } from "@/utils/log";

@RegisterSubCommandGroup("mcserver-admin", "checkout", (builder) =>
  builder.setName("list").setDescription("貸出中サーバー一覧を表示"),
)
export class McServerAdminCheckoutListCommand extends Command {
  public override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction,
  ) {
    await interaction.deferReply();

    try {
      const workflows = await workflowService.findByStatus(
        WorkflowStatus.ACTIVE,
      );

      if (workflows.length === 0) {
        await interaction.editReply("貸出中のサーバーはありません。");
        return;
      }

      const now = new Date();
      const embed = new EmbedBuilder()
        .setTitle("貸出中サーバー一覧")
        .setColor(0x3498db);

      for (const wf of workflows) {
        const remainingDays = wf.endDate
          ? Math.ceil(
              (wf.endDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000),
            )
          : null;

        // サーバーのバインディング名を取得
        const serverName = wf.pteroServerId
          ? await serverBindingService.getName(wf.pteroServerId)
          : null;

        embed.addFields({
          name: `ID: ${wf.id} — ${wf.name}`,
          value: [
            `主催者: <@${wf.organizerDiscordId}>`,
            `サーバー: \`${serverName ?? wf.pteroServerId ?? "未割り当て"}\``,
            `開始日: ${wf.startDate?.toLocaleDateString("ja-JP") ?? "未設定"}`,
            `終了日: ${wf.endDate?.toLocaleDateString("ja-JP") ?? "未設定"}`,
            `残り: ${remainingDays !== null ? `${remainingDays}日` : "未設定"}`,
          ].join("\n"),
        });
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      logger.error(error);
      const message =
        error instanceof Error ? error.message : "不明なエラーが発生しました";
      await interaction.editReply(`エラーが発生しました: ${message}`);
    }
  }
}
