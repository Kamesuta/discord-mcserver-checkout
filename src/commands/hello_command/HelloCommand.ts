import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { CommandGroupInteraction } from "../base/command_base.js";

class HelloCommand extends CommandGroupInteraction {
  // Command configuration
  command = new SlashCommandBuilder()
    .setDescription("Sample Hello command group (/hello)")
    .setName("hello")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageEvents);
}

export default new HelloCommand();
