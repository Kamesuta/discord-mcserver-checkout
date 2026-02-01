import { Subcommand } from "@kaname-png/plugin-subcommands-advanced";
import { ApplyOptions, RegisterChatInputCommand } from "@sapphire/decorators";

@RegisterChatInputCommand<Subcommand>((builder, command) => {
  command.hooks.subcommands(command, builder);
  return builder
    .setName("mcserver")
    .setDescription("Minecraftサーバー管理コマンド");
})
@ApplyOptions<Subcommand.Options>({
  name: "mcserver",
})
export class McServerCommand extends Subcommand {}
