import {
  Command,
  RegisterSubCommandGroup,
} from "@kaname-png/plugin-subcommands-advanced";
import { WorkflowOpCreateModal } from "@/interaction-handlers/workflow/WorkflowOpCreateModal";

@RegisterSubCommandGroup("mcserver-op", "checkout", (builder) =>
  builder
    .setName("create")
    .setDescription(
      "管理者がサーバー貸出を直接作成する（PENDING状態をスキップ）",
    )
    .addUserOption((option) =>
      option.setName("organizer").setDescription("主催者").setRequired(true),
    )
    .addUserOption((option) =>
      option
        .setName("applicant")
        .setDescription("申請者（省略時は主催者と同じ）")
        .setRequired(false),
    )
    .addBooleanOption((option) =>
      option
        .setName("skip-reset")
        .setDescription("サーバーをリセットしない（既存の環境を保持）")
        .setRequired(false),
    ),
)
export class CheckoutCreateCommand extends Command {
  public override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction,
  ) {
    const organizer = interaction.options.getUser("organizer", true);
    const applicant = interaction.options.getUser("applicant") ?? organizer;
    const skipReset = interaction.options.getBoolean("skip-reset") ?? false;

    const modal = WorkflowOpCreateModal.build(
      organizer.id,
      applicant.id,
      skipReset,
      { panelUsers: [organizer.id] },
    );

    await interaction.showModal(modal);
  }
}
