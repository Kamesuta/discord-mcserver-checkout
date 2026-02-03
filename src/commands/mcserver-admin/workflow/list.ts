import {
  Command,
  RegisterSubCommandGroup,
} from "@kaname-png/plugin-subcommands-advanced";
import { EmbedBuilder } from "discord.js";
import { workflowService } from "@/domain/services/WorkflowService";
import { WorkflowStatus } from "@/generated/prisma/client";
import { logger } from "@/utils/log";

@RegisterSubCommandGroup("mcserver-admin", "workflow", (builder) =>
  builder.setName("list").setDescription("承認待ち申請一覧を表示"),
)
export class McServerAdminWorkflowListCommand extends Command {
  public override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction,
  ) {
    await interaction.deferReply();

    try {
      const workflows = await workflowService.findByStatus(
        WorkflowStatus.PENDING,
      );

      if (workflows.length === 0) {
        await interaction.editReply("承認待ちの申請はありません。");
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle("承認待ち申請一覧")
        .setColor(0xf39c12);

      for (const wf of workflows) {
        embed.addFields({
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
