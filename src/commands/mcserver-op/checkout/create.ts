import {
  Command,
  RegisterSubCommandGroup,
} from "@kaname-png/plugin-subcommands-advanced";
import { serverBindingAutocomplete } from "@/domain/utils/serverBindingAutocomplete";
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
    )
    .addStringOption((option) =>
      option
        .setName("server")
        .setDescription("デプロイ先サーバー名（省略時は自動割り当て）")
        .setRequired(false)
        .setAutocomplete(true),
    ),
)
export class CheckoutCreateCommand extends Command {
  public override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction,
  ) {
    const organizer = interaction.options.getUser("organizer", true);
    const applicant = interaction.options.getUser("applicant") ?? organizer;
    const skipReset = interaction.options.getBoolean("skip-reset") ?? false;
    const serverName = interaction.options.getString("server");

    const modal = WorkflowOpCreateModal.build(
      organizer.id,
      applicant.id,
      skipReset,
      serverName ?? undefined,
      { panelUsers: [organizer.id] },
    );

    await interaction.showModal(modal);
  }

  public override async autocompleteRun(
    interaction: Command.AutocompleteInteraction,
  ) {
    await serverBindingAutocomplete(interaction);
  }
}
