import { Subcommand } from "@kaname-png/plugin-subcommands-advanced";
import { ApplyOptions, RegisterChatInputCommand } from "@sapphire/decorators";
import { DispatchAutocomplete } from "@/decorators/DispatchAutocomplete.js";

@RegisterChatInputCommand<Subcommand>((builder, command) => {
  // サブコマンドグループ (hooksの前に設定する必要あり)

  // コマンドの登録
  command.hooks.groups(command, builder);
  command.hooks.subcommands(command, builder);
  return builder
    .setName("ptero")
    .setDescription("Pterodactylサーバー管理コマンド");
})
@ApplyOptions<Subcommand.Options>({
  name: "ptero",
})
@DispatchAutocomplete
export class PteroCommand extends Subcommand {}
