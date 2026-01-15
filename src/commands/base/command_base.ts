import {
  ApplicationCommand,
  ApplicationCommandDataResolvable,
  ChatInputCommandInteraction,
  Interaction,
  SharedSlashCommand,
  SlashCommandBuilder,
  SlashCommandSubcommandBuilder,
  SlashCommandSubcommandGroupBuilder,
  SlashCommandSubcommandsOnlyBuilder,
} from "discord.js";
import { InteractionBase } from "./interaction_base.js";

/**
 * Command-based interaction
 */
export abstract class CommandBasedInteraction extends InteractionBase {
  /**
   * Root command (set when registering subcommands)
   */
  rootCommand?: SharedSlashCommand;

  /**
   * Root command (set by registerSubCommands)
   */
  rootApplicationCommand?: ApplicationCommand;

  /**
   * Function to determine if the interaction belongs to this command
   * @param interaction Interaction
   * @returns Whether the interaction belongs to this command
   */
  abstract isMyInteraction(interaction: ChatInputCommandInteraction): boolean;
}

/**
 * Command group
 */
export abstract class CommandGroupInteraction extends CommandBasedInteraction {
  abstract command: SlashCommandSubcommandsOnlyBuilder;

  /** @inheritdoc */
  override registerCommands(
    commandList: ApplicationCommandDataResolvable[],
  ): void {
    commandList.push(this.command);
    this.rootCommand = this.command;
  }

  /** @inheritdoc */
  isMyInteraction(interaction: ChatInputCommandInteraction): boolean {
    return interaction.commandName === this.command.name;
  }
}

/**
 * Subcommand group
 */
export abstract class SubcommandGroupInteraction extends CommandBasedInteraction {
  abstract command: SlashCommandSubcommandGroupBuilder;

  /**
   * Constructor
   * @param _registry The parent command group to register this subcommand group to
   */
  constructor(private _registry: CommandGroupInteraction) {
    super();
  }

  /** @inheritdoc */
  override registerSubCommands(): void {
    this._registry.command.addSubcommandGroup(this.command);
    this.rootCommand = this._registry.rootCommand;
  }

  /** @inheritdoc */
  isMyInteraction(interaction: ChatInputCommandInteraction): boolean {
    return (
      interaction.options.getSubcommandGroup() === this.command.name &&
      this._registry.isMyInteraction(interaction)
    );
  }
}

/**
 * Command
 */
export abstract class CommandInteraction extends CommandBasedInteraction {
  abstract command: SlashCommandBuilder;

  /** @inheritdoc */
  override registerCommands(
    commandList: ApplicationCommandDataResolvable[],
  ): void {
    commandList.push(this.command);
    this.rootCommand = this.command;
  }

  /** @inheritdoc */
  isMyInteraction(interaction: ChatInputCommandInteraction): boolean {
    return interaction.commandName === this.command.name;
  }

  /** @inheritdoc */
  override async onInteractionCreate(interaction: Interaction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;
    if (!this.isMyInteraction(interaction)) return;
    await this.onCommand(interaction);
  }

  /**
   * Function called when the command is executed
   * @param interaction Interaction
   */
  abstract onCommand(interaction: ChatInputCommandInteraction): Promise<void>;
}

/**
 * Subcommand
 */
export abstract class SubcommandInteraction extends CommandBasedInteraction {
  abstract command: SlashCommandSubcommandBuilder;

  /**
   * Constructor
   * @param _registry The parent command group or subcommand group to register this subcommand to
   */
  constructor(
    private _registry: CommandGroupInteraction | SubcommandGroupInteraction,
  ) {
    super();
  }

  /** @inheritdoc */
  override registerSubCommands(): void {
    this._registry.command.addSubcommand(this.command);
    this.rootCommand = this._registry.rootCommand;
  }

  /** @inheritdoc */
  isMyInteraction(interaction: ChatInputCommandInteraction): boolean {
    return (
      interaction.options.getSubcommand() === this.command.name &&
      this._registry.isMyInteraction(interaction)
    );
  }

  /** @inheritdoc */
  override async onInteractionCreate(interaction: Interaction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;
    if (!this.isMyInteraction(interaction)) return;
    await this.onCommand(interaction);
  }

  /**
   * Function called when the command is executed
   * @param interaction Interaction
   */
  abstract onCommand(interaction: ChatInputCommandInteraction): Promise<void>;
}
