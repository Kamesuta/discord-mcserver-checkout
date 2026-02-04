import {
  Command,
  RegisterSubCommandGroup,
} from "@kaname-png/plugin-subcommands-advanced";
import { MessageFlags } from "discord.js";
import { serverBindingService } from "@/domain/services/ServerBindingService";
import type { ServerBinding } from "@/generated/prisma/browser";
import { logger } from "@/utils/log";

@RegisterSubCommandGroup("mcserver-admin", "server-binding", (builder) =>
  builder.setName("list").setDescription("サーバーバインディング一覧を表示"),
)
export class ServerBindingListCommand extends Command {
  public override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction,
  ) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      const bindings = await serverBindingService.list();

      if (bindings.length === 0) {
        await interaction.editReply(
          "登録されているサーバーバインディングはありません。",
        );
        return;
      }

      const list = bindings
        .map((b: ServerBinding) => `• \`${b.name}\` → \`${b.pteroId}\``)
        .join("\n");

      await interaction.editReply(
        `**サーバーバインディング一覧** (${bindings.length}件)\n\n${list}`,
      );
    } catch (error) {
      logger.error(error);
      const message =
        error instanceof Error ? error.message : "不明なエラーが発生しました";
      await interaction.editReply(`エラーが発生しました: ${message}`);
    }
  }
}
