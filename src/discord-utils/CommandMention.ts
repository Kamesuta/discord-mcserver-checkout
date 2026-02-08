import assert from "node:assert";
import type { Command } from "@kaname-png/plugin-subcommands-advanced";
import { container } from "@sapphire/framework";
import { ApplicationCommandPermissionType, type GuildMember } from "discord.js";

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

  /**
   * コマンドIDを取得する
   * サーバーコマンドがあればサーバーコマンドのIDを返す
   * なければグローバルコマンドのIDを返す
   * それもなければundefinedを返す
   * @param guildId ギルドID
   * @returns コマンドID
   */
  public commandId(guildId: string | null): string | undefined {
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

    return id;
  }

  /**
   * コマンドメンションを返す
   * @param guildId ギルドID
   * @returns コマンドメンション
   */
  public resolve(guildId: string | null): string {
    const id = this.commandId(guildId);
    if (!id) return this.text(); // フォールバック
    // メンションにして返す
    return `<${this.text()}:${id}>`;
  }

  /**
   * コマンドを使用する権限があるかチェックする
   * @param member メンバー
   * @returns 権限がある場合はtrue、ない場合はfalse
   */
  public async checkPermission(member: GuildMember) {
    // コマンドIDを取得
    const commandId = this.commandId(member.guild.id);
    if (!commandId) return false;

    // コマンドを取得
    const command = await member.guild.commands.fetch(commandId);
    if (!command) return false;

    // デフォルトの権限を持っている場合は許可
    if (
      command.defaultMemberPermissions &&
      member.permissions.has(command.defaultMemberPermissions)
    ) {
      return true;
    }

    // 権限を取得
    const permissions = await command.permissions
      .fetch({})
      .catch(() => undefined);
    if (!permissions) return false;

    // コマンドの権限から許可がある権限設定を探す
    return permissions.some((permission) => {
      if (
        permission.type === ApplicationCommandPermissionType.Role &&
        member.roles.cache.has(permission.id)
      ) {
        return permission.permission;
      }
      if (
        permission.type === ApplicationCommandPermissionType.User &&
        member.user.id === permission.id
      ) {
        return permission.permission;
      }
      return false;
    });
  }
}
