import {
  ChatInputCommandInteraction,
  SlashCommandSubcommandBuilder,
} from "discord.js";
import { SubcommandInteraction } from "../base/command_base.js";
import helloCommand from "./HelloCommand.js";
import { sleep } from "../../utils/utils.js";

class HelloWorldCommand extends SubcommandInteraction {
  // Command configuration
  command = new SlashCommandSubcommandBuilder()
    .setName("world")
    .setDescription("Sample Hello World subcommand (/hello world)");

  async onCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    // Start the event
    await interaction.deferReply({ ephemeral: true });

    // Wait for a moment
    await sleep(1000);

    // Reply
    await interaction.editReply({
      content: `Hello World!`,
    });
  }
}

export default new HelloWorldCommand(helloCommand);
