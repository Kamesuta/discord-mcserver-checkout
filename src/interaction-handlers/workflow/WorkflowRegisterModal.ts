import { ApplyOptions } from "@sapphire/decorators";
import {
  InteractionHandler,
  InteractionHandlerTypes,
} from "@sapphire/framework";
import {
  type Guild,
  LabelBuilder,
  MessageFlags,
  ModalBuilder,
  type ModalSubmitInteraction,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import { customIdParams } from "@/discord-utils/customIds";
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
        `register-modal?${new URLSearchParams({ [customIdParams.workflowId]: workflowId, [customIdParams.users]: users.join(",") })}`,
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
          .setDescription(
            "Pterodactyl用ID␣ニックネーム の形式で入力 (スペース区切り)",
          )
          .setTextInputComponent(
            new TextInputBuilder()
              .setCustomId(`username-${discordId}`)
              .setStyle(TextInputStyle.Short)
              .setPlaceholder("例: kamesuta かめすた")
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
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const [, query] = interaction.customId.split("?");
    const params = new URLSearchParams(query);
    const workflowId = Number(params.get(customIdParams.workflowId));
    const users = (params.get(customIdParams.users) ?? "")
      .split(",")
      .filter(Boolean);

    try {
      // 各ユーザーを登録
      for (const discordId of users) {
        const input = interaction.fields
          .getTextInputValue(`username-${discordId}`)
          .trim();

        // スペース区切りでusernameとnicknameを分割
        const parts = input.split(/\s+/);
        if (parts.length < 2) {
          await interaction.editReply(
            `エラー: <@${discordId}> の入力形式が正しくありません。「Pterodactyl用ID␣ニックネーム」の形式で入力してください。`,
          );
          return;
        }

        const username = parts[0];
        const nickname = parts.slice(1).join(" ");

        // Pterodactylに登録してDBに保存
        await userService.registerUser(
          username,
          nickname,
          discordId,
          interaction.guild,
        );
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
