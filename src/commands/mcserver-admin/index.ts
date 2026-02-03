import { Subcommand } from "@kaname-png/plugin-subcommands-advanced";
import { ApplyOptions, RegisterChatInputCommand } from "@sapphire/decorators";
import { DispatchAutocomplete } from "@/decorators/DispatchAutocomplete.js";

@RegisterChatInputCommand<Subcommand>((builder, command) => {
  // サブコマンドグループ (hooksの前に設定する必要あり)
  builder.addSubcommandGroup((group) =>
    group.setName("server-binding").setDescription("サーバーエイリアス管理"),
  );
  builder.addSubcommandGroup((group) =>
    group.setName("server").setDescription("サーバー管理"),
  );

  // コマンドの登録
  command.hooks.groups(command, builder);
  command.hooks.subcommands(command, builder);
  return builder
    .setName("mcserver-admin")
    .setDescription("Minecraftサーバー管理コマンド (イレギュラー対応)");
})
@ApplyOptions<Subcommand.Options>({
  name: "mcserver-admin",
})
@DispatchAutocomplete
export class PteroCommand extends Subcommand {}
