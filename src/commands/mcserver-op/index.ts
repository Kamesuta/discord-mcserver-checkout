import { Subcommand } from "@kaname-png/plugin-subcommands-advanced";
import { ApplyOptions, RegisterChatInputCommand } from "@sapphire/decorators";
import { DispatchAutocomplete } from "@/decorators/DispatchAutocomplete";

@RegisterChatInputCommand<Subcommand>((builder, command) => {
  // サブコマンドグループ (hooksの前に設定する必要あり)
  builder.addSubcommandGroup((group) =>
    group.setName("workflow").setDescription("申請管理"),
  );
  builder.addSubcommandGroup((group) =>
    group.setName("checkout").setDescription("貸出管理"),
  );
  builder.addSubcommandGroup((group) =>
    group.setName("archive").setDescription("アーカイブ管理"),
  );
  builder.addSubcommandGroup((group) =>
    group.setName("user").setDescription("ユーザー管理"),
  );

  // コマンドの登録
  command.hooks.groups(command, builder);
  command.hooks.subcommands(command, builder);
  return builder
    .setName("mcserver-op")
    .setDescription("Minecraftサーバー管理者コマンド");
})
@ApplyOptions<Subcommand.Options>({
  name: "mcserver-op",
})
@DispatchAutocomplete
export class McServerOpCommand extends Subcommand {}
