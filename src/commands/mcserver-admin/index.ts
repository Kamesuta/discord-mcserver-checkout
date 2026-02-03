import {
  type Command,
  Subcommand,
  subCommandsGroupRegistry,
  subCommandsRegistry,
} from "@kaname-png/plugin-subcommands-advanced";
import { ApplyOptions, RegisterChatInputCommand } from "@sapphire/decorators";
import type { AutocompleteInteraction } from "discord.js";

@RegisterChatInputCommand<Subcommand>((builder, command) => {
  // サブコマンドグループ (hooksの前に設定する必要あり)
  builder.addSubcommandGroup((group) =>
    group.setName("server-binding").setDescription("サーバーエイリアス管理"),
  );
  builder.addSubcommandGroup((group) =>
    group.setName("workflow").setDescription("申請管理"),
  );
  builder.addSubcommandGroup((group) =>
    group.setName("checkout").setDescription("貸出管理"),
  );
  builder.addSubcommandGroup((group) =>
    group.setName("archive").setDescription("アーカイブ管理"),
  );

  // コマンドの登録
  command.hooks.groups(command, builder);
  command.hooks.subcommands(command, builder);
  return builder
    .setName("mcserver-admin")
    .setDescription("Minecraftサーバー管理者コマンド");
})
@ApplyOptions<Subcommand.Options>({
  name: "mcserver-admin",
})
export class McServerAdminCommand extends Subcommand {
  public override async autocompleteRun(interaction: AutocompleteInteraction) {
    const groupName = interaction.options.getSubcommandGroup(false);
    const subcommandName = interaction.options.getSubcommand(true);

    let subcommandPiece: Command | undefined;

    if (groupName) {
      // グループサブコマンドの場合
      const groups = subCommandsGroupRegistry.get(this.name);
      const group = groups?.get(groupName);
      const mapping = group?.get(subcommandName);
      subcommandPiece = mapping?.commandPiece;
    } else {
      // 直接のサブコマンドの場合
      const subcommands = subCommandsRegistry.get(this.name);
      const mapping = subcommands?.get(subcommandName);
      subcommandPiece = mapping?.commandPiece;
    }

    if (subcommandPiece?.autocompleteRun) {
      return subcommandPiece.autocompleteRun(interaction);
    }
  }
}
