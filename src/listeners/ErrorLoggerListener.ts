import { ApplyOptions } from "@sapphire/decorators";
import {
  type ChatInputCommandErrorPayload,
  Events,
  type InteractionHandlerError,
  Listener,
} from "@sapphire/framework";
import {
  type ChatInputSubcommandErrorPayload,
  SubcommandPluginEvents,
} from "@sapphire/plugin-subcommands";

/**
 * スラッシュコマンドのエラーがログに流れるようにする
 */
@ApplyOptions<Listener.Options>({
  name: Events.ChatInputCommandError,
  event: Events.ChatInputCommandError,
})
export class ChatInputCommandErrorListener extends Listener {
  public override run(
    error: Error,
    { command, interaction: _ }: ChatInputCommandErrorPayload,
  ) {
    this.container.logger.error(`[コマンドエラー] /${command.name}`, error);
  }
}

/**
 * スラッシュコマンドのエラーがログに流れるようにする
 */
@ApplyOptions<Listener.Options>({
  name: SubcommandPluginEvents.ChatInputSubcommandError,
  event: SubcommandPluginEvents.ChatInputSubcommandError,
})
export class ChatInputSubcommandErrorListener extends Listener {
  public override run(
    error: Error,
    { command, interaction: _ }: ChatInputSubcommandErrorPayload,
  ) {
    this.container.logger.error(`[コマンドエラー] /${command.name}`, error);
  }
}

/**
 * モーダルやボタンなどのインタラクションハンドラーのエラーがログに流れるようにする
 */
@ApplyOptions<Listener.Options>({
  name: Events.InteractionHandlerError,
  event: Events.InteractionHandlerError,
})
export class InteractionHandlerErrorListener extends Listener {
  public override run(
    error: Error,
    { handler, interaction: _ }: InteractionHandlerError,
  ) {
    this.container.logger.error(`[モーダルエラー] ${handler.name}`, error);
  }
}
