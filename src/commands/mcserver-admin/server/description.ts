import {
  Command,
  RegisterSubCommandGroup,
} from "@kaname-png/plugin-subcommands-advanced";
import { MessageFlags } from "discord.js";
import { pterodactylService } from "@/domain/services/pterodactyl/PterodactylService";
import { serverBindingService } from "@/domain/services/ServerBindingService";
import { serverBindingAutocomplete } from "@/domain/utils/serverBindingAutocomplete";
import { logger } from "@/utils/log";

@RegisterSubCommandGroup("mcserver-admin", "server", (builder) =>
  builder
    .setName("description")
    .setDescription("サーバーのDescriptionを取得・更新")
    .addStringOption((option) =>
      option
        .setName("server")
        .setDescription("サーバー名")
        .setRequired(true)
        .setAutocomplete(true),
    )
    .addStringOption((option) =>
      option
        .setName("description")
        .setDescription("新しいDescription（省略時は現在の値を表示）")
        .setRequired(false),
    ),
)
export class ServerDescriptionCommand extends Command {
  public override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction,
  ) {
    const name = interaction.options.getString("server", true);
    const newDescription = interaction.options.getString("description");

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      // サーバー名をPterodactyl IDに変換
      const pteroId = await serverBindingService.resolve(name);

      if (newDescription === null) {
        // Descriptionを取得して表示
        const details = await pterodactylService.getServerDetails(pteroId);
        await interaction.editReply(
          `サーバー \`${name}\` の現在のDescription:\n\`\`\`\n${details.description || "(空)"}\n\`\`\``,
        );
      } else {
        // Descriptionを更新
        await pterodactylService.updateServerDescription(
          pteroId,
          newDescription,
        );
        await interaction.editReply(
          `サーバー \`${name}\` のDescriptionを更新しました:\n\`\`\`\n${newDescription}\n\`\`\``,
        );
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
    await serverBindingAutocomplete(interaction);
  }
}
