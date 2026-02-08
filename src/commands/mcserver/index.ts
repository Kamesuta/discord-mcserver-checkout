import { Subcommand } from "@kaname-png/plugin-subcommands-advanced";
import { ApplyOptions, RegisterChatInputCommand } from "@sapphire/decorators";
import { DispatchAutocomplete } from "@/discord-utils/DispatchAutocomplete.js";

@RegisterChatInputCommand<Subcommand>((builder, command) => {
  command.hooks.subcommands(command, builder);
  return builder
    .setName("mcserver")
    .setDescription("Minecraftサーバー管理コマンド");
})
@ApplyOptions<Subcommand.Options>({
  name: "mcserver",
})
@DispatchAutocomplete
export class McServerCommand extends Subcommand {}
