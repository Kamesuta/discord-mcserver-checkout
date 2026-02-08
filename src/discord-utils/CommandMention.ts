import assert from "node:assert";
import type { Command } from "@kaname-png/plugin-subcommands-advanced";
import { container } from "@sapphire/framework";

/**
 * Discord のコマンドメンション構文を返す。
 *
 * - サブコマンド: `</parent subcommand:id>`
 * - グループサブコマンド: `</parent group subcommand:id>`
 */
export class CommandMention {
  constructor(public command: string) {}

  public validate(command: Command) {
    assert(this.command === command.name);
  }

  public text() {
    return `/${this.command.replaceAll("/", " ")}`;
  }

  public resolve(guildId: string | null) {
    // ルートコマンドを取得
    const rootCommandName = this.command.split("/")[0];

    // コマンドレジストリを取得
    const registry = container.stores
      .get("commands")
      .get(rootCommandName)?.applicationCommandRegistry;
    if (!registry) return this.text(); // フォールバック

    // ギルドコマンドがあれば取得
    const idsGuild = guildId
      ? registry.guildIdToChatInputCommandIds.get(guildId)
      : undefined;
    // ない場合、グローバルコマンドを取得
    const ids = idsGuild ?? registry.globalChatInputCommandIds;
    const id = ids.values().next().value;
    if (!id) return this.text(); // フォールバック

    // メンションにして返す
    return `<${this.text()}:${id}>`;
  }
}
