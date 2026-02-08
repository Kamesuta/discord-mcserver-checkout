import {
  type Command,
  type Subcommand,
  subCommandsGroupRegistry,
  subCommandsRegistry,
} from "@kaname-png/plugin-subcommands-advanced";
import { createClassDecorator, createProxy } from "@sapphire/decorators";
import type { AutocompleteInteraction } from "discord.js";

/**
 * サブコマンドのautocompleteRunを自動的にディスパッチするデコレータ
 *
 * メインコマンドクラスに適用すると、autocompleteRunメソッドを自動的に追加し、
 * サブコマンドのautocompleteRunを適切にディスパッチします。
 *
 * @example
 * ```typescript
 * @DispatchAutocomplete
 * export class McServerAdminCommand extends Subcommand {}
 * ```
 */
export const DispatchAutocomplete = createClassDecorator(
  (target: new (...args: unknown[]) => Subcommand) =>
    createProxy(target, {
      construct: (ctor, args) => {
        const instance = new ctor(...args);

        // autocompleteRunメソッドを追加
        instance.autocompleteRun = async (
          interaction: AutocompleteInteraction,
        ) => {
          const groupName = interaction.options.getSubcommandGroup(false);
          const subcommandName = interaction.options.getSubcommand(true);

          let subcommandPiece: Command | undefined;

          if (groupName) {
            // グループサブコマンドの場合
            const groups = subCommandsGroupRegistry.get(instance.name);
            const group = groups?.get(groupName);
            const mapping = group?.get(subcommandName);
            subcommandPiece = mapping?.commandPiece;
          } else {
            // 直接のサブコマンドの場合
            const subcommands = subCommandsRegistry.get(instance.name);
            const mapping = subcommands?.get(subcommandName);
            subcommandPiece = mapping?.commandPiece;
          }

          if (subcommandPiece?.autocompleteRun) {
            return subcommandPiece.autocompleteRun(interaction);
          }
        };

        return instance;
      },
    }),
);
