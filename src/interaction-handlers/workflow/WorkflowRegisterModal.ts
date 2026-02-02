import { ApplyOptions } from "@sapphire/decorators";
import {
  InteractionHandler,
  InteractionHandlerTypes,
} from "@sapphire/framework";
import type { ModalSubmitInteraction } from "discord.js";
import { completeApproval } from "../../domain/flows/ApprovalFlow.js";
import { pterodactylUserService } from "../../domain/services/pterodactyl/PterodactylUserService.js";
import { logger } from "../../utils/log.js";
import { prisma } from "../../utils/prisma.js";

@ApplyOptions<InteractionHandler.Options>({
  interactionHandlerType: InteractionHandlerTypes.ModalSubmit,
})
export class WorkflowRegisterModal extends InteractionHandler {
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

        // Pterodactylに登録
        await pterodactylUserService.registerUser(username);

        // DBに保存
        await prisma.pterodactylUser.create({
          data: {
            discordId,
            username,
            email: `${username}@kpw.local`,
          },
        });
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
