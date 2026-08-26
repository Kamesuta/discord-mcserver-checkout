import {
  Command,
  RegisterSubCommandGroup,
} from "@kaname-png/plugin-subcommands-advanced";
import { MessageFlags } from "discord.js";
import { serverBindingService } from "@/domain/services/ServerBindingService";
import { serverTypeLabels } from "@/domain/utils/serverType";
import { ServerType } from "@/generated/prisma/client";
import { logger } from "@/utils/log";

@RegisterSubCommandGroup("mcserver-admin", "server-binding", (builder) =>
  builder
    .setName("set")
    .setDescription("サーバーバインディングを設定")
    .addStringOption((option) =>
      option
        .setName("name")
        .setDescription("サーバー名 (例: server01)")
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("ptero-id")
        .setDescription("Pterodactyl サーバーID (例: 354dc039)")
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("type")
        .setDescription("サーバー種別 (省略時: 新規は通常鯖、既存は変更なし)")
        .addChoices(
          { name: serverTypeLabels.SERVER, value: ServerType.SERVER },
          { name: serverTypeLabels.MOD, value: ServerType.MOD },
        )
        .setRequired(false),
    ),
)
export class ServerBindingSetCommand extends Command {
  public override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction,
  ) {
    const name = interaction.options.getString("name", true);
    const pteroId = interaction.options.getString("ptero-id", true);
    const type =
      (interaction.options.getString("type") as ServerType | null) ?? undefined;

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      const binding = await serverBindingService.set(name, pteroId, type);
      await interaction.editReply(
        `サーバーバインディングを設定しました: \`${name}\` → \`${pteroId}\` (${serverTypeLabels[binding.type]})`,
      );
    } catch (error) {
      logger.error(error);
      const message =
        error instanceof Error ? error.message : "不明なエラーが発生しました";
      await interaction.editReply(`エラーが発生しました: ${message}`);
    }
  }
}
