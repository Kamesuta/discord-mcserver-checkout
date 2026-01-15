import {
  ApplicationCommandDataResolvable,
  ApplicationCommandType,
  ContextMenuCommandBuilder,
  Interaction,
  MessageContextMenuCommandInteraction,
  UserContextMenuCommandInteraction,
} from "discord.js";
import { InteractionBase } from "./interaction_base.js";

/**
 * User Context Menu
 */
export abstract class UserContextMenuInteraction extends InteractionBase {
  abstract command: ContextMenuCommandBuilder;

  /** @inheritdoc */
  override registerCommands(
    commandList: ApplicationCommandDataResolvable[],
  ): void {
    commandList.push(this.command.setType(ApplicationCommandType.User));
  }

  /** @inheritdoc */
  override async onInteractionCreate(interaction: Interaction): Promise<void> {
    // Context menu triggered by right-clicking a user
    if (!interaction.isUserContextMenuCommand()) return;
    if (interaction.commandName !== this.command.name) return;
    await this.onCommand(interaction);
  }

  /**
   * Function called when the command is executed
   * @param interaction Interaction
   */
  abstract onCommand(
    interaction: UserContextMenuCommandInteraction,
  ): Promise<void>;
}

/**
 * Message Context Menu
 */
export abstract class MessageContextMenuInteraction extends InteractionBase {
  abstract command: ContextMenuCommandBuilder;

  /** @inheritdoc */
  override registerCommands(
    commandList: ApplicationCommandDataResolvable[],
  ): void {
    commandList.push(this.command.setType(ApplicationCommandType.Message));
  }

  /** @inheritdoc */
  override async onInteractionCreate(interaction: Interaction): Promise<void> {
    // Context menu triggered by right-clicking a message
    if (!interaction.isMessageContextMenuCommand()) return;
    if (interaction.commandName !== this.command.name) return;
    await this.onCommand(interaction);
  }

  /**
   * Function called when the command is executed
   * @param interaction Interaction
   */
  abstract onCommand(
    interaction: MessageContextMenuCommandInteraction,
  ): Promise<void>;
}
