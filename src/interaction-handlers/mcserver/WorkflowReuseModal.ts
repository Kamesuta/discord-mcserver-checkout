import { ApplyOptions } from "@sapphire/decorators";
import {
  InteractionHandler,
  InteractionHandlerTypes,
} from "@sapphire/framework";
import {
  LabelBuilder,
  ModalBuilder,
  type ModalBuilder as ModalBuilderType,
  type ModalSubmitInteraction,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import { commandMentions } from "@/discord-utils/commands.js";
import { customIdParams } from "@/discord-utils/customIds";
import { createReuseConfirmation } from "@/domain/flows/ReuseFlow";
import {
  type ReuseFileMode,
  reuseDraftService,
} from "@/domain/services/ReuseDraftService";
import type { BaseWorkflowParams } from "@/domain/services/WorkflowService";
import { workflowService } from "@/domain/services/WorkflowService";
import { parseMcVersionInput } from "@/domain/utils/serverType";
import { WorkflowStatus } from "@/generated/prisma/client";
import env from "@/utils/env";
import { logger } from "@/utils/log";

@ApplyOptions<InteractionHandler.Options>({
  interactionHandlerType: InteractionHandlerTypes.ModalSubmit,
})
export class WorkflowReuseModal extends InteractionHandler {
  static build(
    sourceWorkflowId: number,
    defaults?: {
      name?: string;
      mcVersion?: string;
      description?: string;
      fileMode?: ReuseFileMode;
    },
  ): ModalBuilderType {
    const modal = new ModalBuilder()
      .setCustomId(
        `reuse-modal?${new URLSearchParams({
          [customIdParams.sourceWorkflowId]: String(sourceWorkflowId),
        })}`,
      )
      .setTitle("サーバー流用");

    const nameInput = new TextInputBuilder()
      .setCustomId("name")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("例: 01/01 マイクラ正月福笑い")
      .setRequired(true);
    if (defaults?.name) {
      nameInput.setValue(defaults.name);
    }

    modal.addLabelComponents(
      new LabelBuilder()
        .setLabel("サーバーの用途/企画名")
        .setDescription(
          "日付␣企画名 の形式で入力 (スペース区切りで日付と企画名を記載)",
        )
        .setTextInputComponent(nameInput),
    );

    const mcVersionInput = new TextInputBuilder()
      .setCustomId("mc-version")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("例: 1.20.1 / Mod鯖の場合: 1.20.1 Mod")
      .setRequired(false);
    if (defaults?.mcVersion) {
      mcVersionInput.setValue(defaults.mcVersion);
    }

    modal.addLabelComponents(
      new LabelBuilder()
        .setLabel("Minecraft バージョン")
        .setDescription(
          "空の場合、元の企画のバージョンを引き継ぎます。Mod鯖を希望する場合は「Mod」と記載してください",
        )
        .setTextInputComponent(mcVersionInput),
    );

    // 流用ではパネルユーザーは変更させず、既存申請の設定を引き継ぐ。
    // 代わりにサーバーファイルを保持するかどうかを選ばせる。
    const fileModeMenu = new StringSelectMenuBuilder()
      .setCustomId("file-mode")
      .setMinValues(1)
      .setMaxValues(1)
      .setRequired(true)
      .addOptions(
        {
          label: "保持しない (リセットする)",
          value: "reset",
          default: (defaults?.fileMode ?? "reset") === "reset",
        },
        {
          label: "保持する (鯖に入っているファイルはそのまま)",
          value: "keep",
          default: defaults?.fileMode === "keep",
        },
      );

    modal.addLabelComponents(
      new LabelBuilder()
        .setLabel("サーバーファイルを保持するか？")
        .setDescription(
          "どちらを選んでもバックアップは取られ、アーカイブに保存されます",
        )
        .setStringSelectMenuComponent(fileModeMenu),
    );

    const descriptionInput = new TextInputBuilder()
      .setCustomId("description")
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(false);
    if (defaults?.description) {
      descriptionInput.setValue(defaults.description);
    }

    modal.addLabelComponents(
      new LabelBuilder()
        .setLabel("補足説明 (任意)")
        .setDescription(
          "イベント準備以外の申請の場合は、企画発足フォーラムへのリンクを記載してください",
        )
        .setTextInputComponent(descriptionInput),
    );

    return modal;
  }

  public override parse(interaction: ModalSubmitInteraction) {
    if (!interaction.customId.startsWith("reuse-modal")) return this.none();
    return this.some();
  }

  public override async run(interaction: ModalSubmitInteraction) {
    await interaction.deferReply({ ephemeral: true });

    // /mcserver が使える人のみ流用できる
    const isGeneral =
      interaction.inCachedGuild() &&
      (await commandMentions.mcserver.checkPermission(interaction.member));
    if (!isGeneral) {
      await interaction.editReply("この操作を実行する権限がありません。");
      return;
    }

    const [, query] = interaction.customId.split("?");
    const sourceWorkflowId = Number(
      new URLSearchParams(query).get(customIdParams.sourceWorkflowId),
    );

    if (Number.isNaN(sourceWorkflowId)) {
      await interaction.editReply(
        "エラー: 流用元申請IDが見つかりませんでした。",
      );
      return;
    }

    try {
      const sourceWorkflow = await workflowService.findById(sourceWorkflowId);
      if (!sourceWorkflow || !sourceWorkflow.pteroServerId) {
        await interaction.editReply("流用元の申請が見つかりませんでした。");
        return;
      }

      if (sourceWorkflow.status !== WorkflowStatus.ACTIVE) {
        await interaction.editReply("この申請は現在流用できません。");
        return;
      }

      if (sourceWorkflow.organizerDiscordId !== interaction.user.id) {
        await interaction.editReply("この申請を流用する権限がありません。");
        return;
      }

      const fields = await this._extractFields(interaction, sourceWorkflowId);
      if (!fields) {
        return;
      }

      const token = reuseDraftService.create({
        sourceWorkflowId,
        applicantDiscordId: interaction.user.id,
        organizerDiscordId: sourceWorkflow.organizerDiscordId,
        fields: fields.workflowFields,
        fileMode: fields.fileMode,
      });

      const { embed, row } = await createReuseConfirmation(
        sourceWorkflowId,
        token,
      );
      await interaction.editReply({ embeds: [embed], components: [row] });
    } catch (error) {
      logger.error("流用確認の準備中にエラーが発生しました:", error);
      const message =
        error instanceof Error ? error.message : "不明なエラーが発生しました";
      await interaction.editReply(
        `流用確認の準備中にエラーが発生しました: ${message}`,
      );
    }
  }

  /**
   * 流用専用のモーダル入力を抽出する
   *
   * 流用ではパネルユーザーを編集させず、元申請の設定をそのまま引き継ぐ。
   * その代わり、ファイル保持の有無をここで受け取る。
   */
  private async _extractFields(
    interaction: ModalSubmitInteraction,
    sourceWorkflowId: number,
  ): Promise<
    | {
        workflowFields: BaseWorkflowParams;
        fileMode: ReuseFileMode;
      }
    | undefined
  > {
    const sourceWorkflow = await workflowService.findById(sourceWorkflowId);
    if (!sourceWorkflow) {
      await interaction.editReply("流用元の申請が見つかりませんでした。");
      return undefined;
    }

    const nameInput = interaction.fields.getTextInputValue("name");
    const description = interaction.fields.getTextInputValue("description");
    const mcVersionInput = interaction.fields.getTextInputValue("mc-version");
    // バージョン欄に「Mod」が含まれていたらMod鯖申請として扱い、種別とバージョンを分離する
    const { serverType, mcVersion } = parseMcVersionInput(mcVersionInput);

    const fileModeField = interaction.fields.fields.get("file-mode");
    const fileMode =
      fileModeField && "values" in fileModeField
        ? ((fileModeField.values[0] as ReuseFileMode | undefined) ?? "reset")
        : "reset";

    // 「Mod」以外の文字が入っているのにバージョンを取り出せない場合はエラー
    if (mcVersionInput.replace(/mod/gi, "").trim() && !mcVersion) {
      await interaction.editReply(
        "Minecraft バージョンの形式が正しくありません (例: 1.21 または 1.20.1 Mod)。空の場合は元の企画のバージョンが引き継がれます。",
      );
      return undefined;
    }

    const { eventDate, eventEndDate, name } =
      this._parseNameWithDate(nameInput);

    // 新規申請と同じルールで貸出期間を再計算する。
    let periodDays: number;
    if (eventDate) {
      const now = new Date();
      const baseDate = eventEndDate || eventDate;
      const deadlineDate = new Date(baseDate);
      deadlineDate.setDate(deadlineDate.getDate() + 2);
      periodDays = Math.ceil(
        (deadlineDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000),
      );

      if (periodDays < 1) {
        await interaction.editReply(
          "指定されたイベント日付は過去です。将来の日付を入力してください。",
        );
        return undefined;
      }
    } else {
      periodDays = env.CHECKOUT_DEFAULT_PERIOD_DAYS;
    }

    return {
      workflowFields: {
        name,
        description: description || undefined,
        // 空欄時は最新版ではなく、元企画のバージョン・種別をそのまま引き継ぐ
        mcVersion: mcVersion ?? sourceWorkflow.mcVersion ?? undefined,
        serverType: mcVersionInput ? serverType : sourceWorkflow.serverType,
        periodDays,
        panelUsers: sourceWorkflow.panelUsers.map((user) => user.discordId),
        eventDate,
      },
      fileMode,
    };
  }

  /**
   * 既存の申請モーダルと同じルールで日付付き企画名を解釈する
   */
  private _parseNameWithDate(input: string): {
    eventDate?: Date;
    eventEndDate?: Date;
    name: string;
  } {
    const match = input.match(
      /^((?:\d{4}[-/])?\d{1,2}[-/]\d{1,2})(?:[〜～]((?:\d{4}[-/])?\d{1,2}[-/]\d{1,2}))?[\s\u3000]+(.+)$/,
    );
    if (!match) {
      return { name: input };
    }

    const [, startDateStr, endDateStr, eventName] = match;
    const eventDate = this._parseSingleDate(startDateStr);
    if (!eventDate) {
      return { name: input };
    }

    let eventEndDate: Date | undefined;
    if (endDateStr) {
      eventEndDate = this._parseSingleDate(endDateStr, eventDate.getFullYear());
      if (!eventEndDate) {
        return { name: input };
      }
    }

    return { eventDate, eventEndDate, name: eventName };
  }

  /**
   * 既存の申請モーダルと同じルールで日付を解釈する
   */
  private _parseSingleDate(
    dateStr: string,
    baseYear?: number,
  ): Date | undefined {
    const parts = dateStr.split(/[-/]/);

    let year: number;
    let month: number;
    let day: number;

    if (parts.length === 2) {
      month = Number.parseInt(parts[0], 10);
      day = Number.parseInt(parts[1], 10);

      if (baseYear !== undefined) {
        year = baseYear;
      } else {
        const now = new Date();
        year = now.getFullYear();
        const eventDate = new Date(year, month - 1, day);
        if (eventDate < now) {
          year += 1;
        }
      }
    } else if (parts.length === 3) {
      year = Number.parseInt(parts[0], 10);
      month = Number.parseInt(parts[1], 10);
      day = Number.parseInt(parts[2], 10);
    } else {
      return undefined;
    }

    const date = new Date(year, month - 1, day);
    if (Number.isNaN(date.getTime()) || date.getMonth() !== month - 1) {
      return undefined;
    }

    return date;
  }
}
