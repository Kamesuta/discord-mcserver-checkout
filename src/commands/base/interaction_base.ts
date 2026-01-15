import { ApplicationCommandDataResolvable, Interaction } from "discord.js";

/**
 * Base class for commands, buttons, context menus, and other interactions
 */
export abstract class InteractionBase {
  /**
   * Function to register commands to the ApplicationCommandManager.
   * By pushing commands into the commandList, all commands can be registered to Discord at once after all commands are added.
   * @param _commandList List of commands to register to the ApplicationCommandManager
   */
  registerCommands(_commandList: ApplicationCommandDataResolvable[]): void {}

  /**
   * Function to register subcommands to other InteractionBase (e.g., commands).
   * After all subcommands are registered, registerCommands() is called.
   */
  registerSubCommands(): void {}

  /**
   * Function called when the InteractionCreate event occurs.
   * This is called for all registered InteractionBase instances.
   * Use an if statement to determine and execute the necessary processing.
   * @param _interaction Interaction that occurred during the InteractionCreate event
   */
  async onInteractionCreate(_interaction: Interaction): Promise<void> {}
}
