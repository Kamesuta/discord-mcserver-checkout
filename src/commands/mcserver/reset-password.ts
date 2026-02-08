import {
  Command,
  RegisterSubCommand,
} from "@kaname-png/plugin-subcommands-advanced";
import { MessageFlags } from "discord.js";
import { userService } from "@/domain/services/UserService";
import { workflowService } from "@/domain/services/WorkflowService";
import { logger } from "@/utils/log";

@RegisterSubCommand("mcserver", (builder) =>
  builder
    .setName("reset-password")
    .setDescription("Pterodactylのパスワードをリセットする"),
)
export class McServerResetPasswordCommand extends Command {
  public override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction,
  ) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    try {
      // 実行者のDiscord IDからPterodactylUserを検索
      const pteroUser = await userService.findByDiscordId(interaction.user.id);

      if (!pteroUser) {
        await interaction.editReply(
          "あなたのPterodactylアカウントが見つかりませんでした。管理者に連絡してください。",
        );
        return;
      }

      const newPassword = await userService.resetPassword(interaction.user.id);

      // ユーザーが所属するACTIVEワークフローを検索し、サーバーのサブユーザーを同期
      const activeWorkflows =
        await workflowService.findActiveWorkflowsByPanelUser(
          interaction.user.id,
        );

      for (const workflow of activeWorkflows) {
        if (workflow.pteroServerId) {
          try {
            const panelUserIds = workflow.panelUsers.map((u) => u.discordId);
            await userService.ensureServerUsers(
              workflow.pteroServerId,
              panelUserIds,
            );
          } catch (error) {
            logger.error(
              `ワークフロー ${workflow.id} のサーバーユーザー同期に失敗:`,
              error,
            );
            // 継続
          }
        }
      }

      // ユーザーへの返信メッセージを作成
      await interaction.editReply(
        `パスワードをリセットしました。\n` +
          `ID: \`${pteroUser.username}\`\n` +
          `新しいパスワード: \`${newPassword}\``,
      );
    } catch (error) {
      logger.error(error);
      const message =
        error instanceof Error ? error.message : "不明なエラーが発生しました";
      await interaction.editReply(`エラーが発生しました: ${message}`);
    }
  }
}
