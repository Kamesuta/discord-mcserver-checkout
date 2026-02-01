import { Subcommand } from "@kaname-png/plugin-subcommands-advanced";
import { ApplyOptions, RegisterChatInputCommand } from "@sapphire/decorators";

@RegisterChatInputCommand<Subcommand>((builder, command) => {
  // サブコマンドグループ (hooksの前に設定する必要あり)
  builder.addSubcommandGroup((group) =>
    group.setName("server-binding").setDescription("サーバーエイリアス管理"),
  );
  builder.addSubcommandGroup((group) =>
    group.setName("workflow").setDescription("申請管理"),
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
export class McServerAdminCommand extends Subcommand {}
