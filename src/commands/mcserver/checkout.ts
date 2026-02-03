import {
  Command,
  RegisterSubCommand,
} from "@kaname-png/plugin-subcommands-advanced";
import { BaseCheckoutModalHandler } from "@/interaction-handlers/workflow/WorkflowBaseModal";

@RegisterSubCommand("mcserver", (builder) =>
  builder
    .setName("checkout")
    .setDescription("サーバー貸出申請を行う")
    .addUserOption((option) =>
      option.setName("organizer").setDescription("主催者").setRequired(false),
    ),
)
export class McServerCheckoutCommand extends Command {
  public override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction,
  ) {
    const organizer =
      interaction.options.getUser("organizer") ?? interaction.user;

    const params = new URLSearchParams({
      organizerId: organizer.id,
    });

    const modal = BaseCheckoutModalHandler.build(
      `checkout-modal?${params.toString()}`,
      "サーバー貸出申請",
      { panelUsers: [interaction.user.id] },
    );

    await interaction.showModal(modal);
  }
}
