import { ApplicationCommandDataResolvable, Interaction } from "discord.js";
import { client } from "../index.js";
import { logger } from "../utils/log.js";
import { InteractionBase } from "./base/interaction_base.js";
import { CommandBasedInteraction } from "./base/command_base.js";
import { config } from "../utils/config.js";

/**
 * Command Handler
 */
export default class CommandHandler {
  /**
   * Initializes the command handler
   * @param _commands List of commands
   */
  constructor(private _commands: InteractionBase[]) {}

  /**
   * Registers commands
   */
  async registerCommands(): Promise<void> {
    // List of commands to register
    const applicationCommands: ApplicationCommandDataResolvable[] = [];

    // Build subcommands
    this._commands.forEach((command) => command.registerSubCommands());

    // Build commands
    this._commands.forEach((command) =>
      command.registerCommands(applicationCommands),
    );

    // If you want to register global commands instead of per-server, adjust the commented-out section below

    // // Register global commands
    // await client.application?.commands.set(applicationCommands);

    // Register commands per server
    for (const guildId of config.guild_ids) {
      // Fetch the server (ignore if it cannot be fetched)
      const guild = await client.guilds.fetch(guildId).catch((_) => {});

      // Register commands
      const registeredCommands = await guild?.commands.set(applicationCommands);

      // Set rootApplicationCommand to each command class after registration
      if (registeredCommands) {
        this._commands
          .filter(
            (command): command is CommandBasedInteraction =>
              command instanceof CommandBasedInteraction,
          )
          .map((command) => ({
            command,
            registeredCommand: registeredCommands.find(
              (c) => c.name === command.rootCommand?.name,
            ),
          }))
          .filter(({ registeredCommand }) => registeredCommand !== undefined)
          .forEach(({ command, registeredCommand }) => {
            command.rootApplicationCommand = registeredCommand!;
          });
      }
    }
  }

  /**
   * Handles interaction events
   * @param interaction Interaction
   */
  async onInteractionCreate(interaction: Interaction): Promise<void> {
    try {
      // Process all commands
      await Promise.all(
        this._commands.map((command) =>
          command.onInteractionCreate(interaction),
        ),
      );
    } catch (error) {
      logger.error("An error occurred during onInteractionCreate.", error);
    }
  }
}
