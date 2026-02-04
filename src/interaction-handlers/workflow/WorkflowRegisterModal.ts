import { ApplyOptions } from "@sapphire/decorators";
import {
  InteractionHandler,
  InteractionHandlerTypes,
} from "@sapphire/framework";
import {
  type Guild,
  LabelBuilder,
  ModalBuilder,
  type ModalSubmitInteraction,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import { completeApproval } from "@/domain/flows/ActivationFlow";
import { userService } from "@/domain/services/UserService";
import { logger } from "@/utils/log";

@ApplyOptions<InteractionHandler.Options>({
  interactionHandlerType: InteractionHandlerTypes.ModalSubmit,
})
export class WorkflowRegisterModal extends InteractionHandler {
  static async build(
    workflowId: string,
    users: string[],
    guild: Guild,
  ): Promise<ModalBuilder> {
    const modal = new ModalBuilder()
      .setCustomId(
        `register-modal?${new URLSearchParams({ workflowId, users: users.join(",") })}`,
      )
      .setTitle("パネルユーザー登録");

    for (const discordId of users) {
      let label = discordId;
      try {
        const member = await guild.members.fetch(discordId);
        label = member.displayName;
      } catch {
        // ユーザー情報取得失敗時はIDを使用
      }

      modal.addLabelComponents(
        new LabelBuilder()
          .setLabel(`${label} のユーザー名`)
          .setTextInputComponent(
            new TextInputBuilder()
              .setCustomId(`username-${discordId}`)
              .setStyle(TextInputStyle.Short)
              .setPlaceholder("半角英数のみ")
              .setRequired(true),
          ),
      );
    }

    return modal;
  }

  public override parse(interaction: ModalSubmitInteraction) {
    if (!interaction.customId.startsWith("register-modal")) return this.none();
    return this.some();
  }

  public override async run(interaction: ModalSubmitInteraction) {
    await interaction.deferReply();

    const [, query] = interaction.customId.split("?");
    const params = new URLSearchParams(query);
    const workflowId = Number(params.get("workflowId"));
    const users = (params.get("users") ?? "").split(",").filter(Boolean);

    try {
      // 各ユーザーを登録
      for (const discordId of users) {
        const username = interaction.fields
          .getTextInputValue(`username-${discordId}`)
          .trim();

        // Pterodactylに登録してDBに保存
        await userService.registerUser(username, discordId, interaction.guild);
      }

      // 承認処理を続行
      await completeApproval(interaction, workflowId);
    } catch (error) {
      logger.error("ユーザー登録・承認処理中にエラーが発生しました:", error);
      const message =
        error instanceof Error ? error.message : "不明なエラーが発生しました";
      await interaction.editReply(`エラーが発生しました: ${message}`);
    }
  }
}
