import assert from "node:assert";
import type { Command } from "@kaname-png/plugin-subcommands-advanced";
import { container } from "@sapphire/framework";
import {
  type ApplicationCommandPermissions,
  ApplicationCommandPermissionType,
  type GuildMember,
} from "discord.js";

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
   * 簡略化のため、チャンネルごとの権限チェックは未対応
   * 参考: https://www.answeroverflow.com/m/1009673144149229658
   * @param member メンバー
   * @returns 権限がある場合はtrue、ない場合はfalse
   */
  public async checkPermission(member: GuildMember): Promise<boolean> {
    // コマンドIDを取得
    const commandId = this.commandId(member.guild.id);
    if (!commandId) return false;

    // 権限オーバーライドを取得
    const permissionOverrides = await member.guild.commands.permissions.fetch(
      {},
    );

    // コマンドの権限オーバーライドをチェック
    const commandPermissions = permissionOverrides.get(commandId);
    if (commandPermissions) {
      const result = await this._getMatchOverride(member, commandPermissions);
      if (result !== undefined) return result;
    }

    // 連携サービスのオーバーライドをチェック
    const botPermissions = permissionOverrides.get(
      member.client.application.id,
    );
    if (botPermissions) {
      const result = await this._getMatchOverride(member, botPermissions);
      if (result !== undefined) return result;
    }

    // 連携サービスのeveryoneが許可
    return true;
  }

  /**
   * メンバーに一致する権限オーバーライドを取得する
   * @param member メンバー
   * @param permissions 権限オーバーライド
   * @returns 一致する権限オーバーライド、または undefined
   */
  private async _getMatchOverride(
    member: GuildMember,
    permissions: ApplicationCommandPermissions[],
  ): Promise<boolean | undefined> {
    // メンバーオーバーライド
    const memberOverride = permissions.find(
      (p) =>
        p.type === ApplicationCommandPermissionType.User && p.id === member.id,
    )?.permission;
    if (memberOverride !== undefined) {
      // メンバーの権限が設定されている場合は、それを優先
      return memberOverride;
    }

    // @everyone に対して許可されているか、設定がない場合undefined
    const everyoneAllowed = permissions.find(
      (p) => p.id === member.guild.id,
    )?.permission;

    // ロールオーバーライド
    const roleOverrides = permissions
      .filter(
        (p) =>
          p.type === ApplicationCommandPermissionType.Role &&
          member.roles.cache.has(p.id),
      )
      .map((p) => p.permission);

    // @everyone が許可されていて、かつロールに拒否設定がある場合拒否
    if (everyoneAllowed === true && roleOverrides.every((r) => r === false)) {
      return false;
    }
    // @everyone が拒否されていて、かつロールに許可がある場合は許可
    if (everyoneAllowed === false && roleOverrides.some((r) => r === true)) {
      return true;
    }

    // マッチするロールがない場合は @everyone の設定を返す
    return everyoneAllowed;
  }
}
