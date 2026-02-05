import { InteractionHandler } from "@sapphire/framework";
import {
  LabelBuilder,
  MessageFlags,
  ModalBuilder,
  type ModalSubmitInteraction,
  TextInputBuilder,
  TextInputStyle,
  UserSelectMenuBuilder,
} from "discord.js";
import semver from "semver";
import type { BaseWorkflowParams } from "@/domain/services/WorkflowService";

/** モーダルフィールドのデフォルト値 */
export interface CheckoutModalDefaults {
  /** サーバーの用途/企画名 */
  name?: string;
  /** 貸出希望期間（日数） */
  period?: string;
  /** Minecraft バージョン */
  mcVersion?: string;
  /** パネル権限付与対象ユーザーの Discord ユーザーID一覧 */
  panelUsers?: string[];
  /** 補足説明 */
  description?: string;
}

/**
 * モーダルハンドラーの基底クラス。
 *
 * フィールド抽出・バリデーションを共通化し、
 * サブクラスで execute に実行ロジックを実装する。
 */
export abstract class WorkflowBaseCheckoutModal extends InteractionHandler {
  /**
   * サーバー貸出申請モーダルを生成する。
   * サブクラスの static build から呼び出す。
   * @param customId モーダルの customId
   * @param title モーダルのタイトル
   * @param defaults デフォルト値（省略時は空）
   */
  protected static buildModal(
    customId: string,
    title: string,
    defaults?: CheckoutModalDefaults,
  ): ModalBuilder {
    const modal = new ModalBuilder().setCustomId(customId).setTitle(title);

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

    const periodInput = new TextInputBuilder()
      .setCustomId("period")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("例: 30")
      .setRequired(true);
    if (defaults?.period) {
      periodInput.setValue(defaults.period);
    }

    modal.addLabelComponents(
      new LabelBuilder()
        .setLabel("貸出希望期間 (日数)")
        .setDescription(
          "イベント準備用の場合、イベントまでの日数を入力してください",
        )
        .setTextInputComponent(periodInput),
    );

    const mcVersionInput = new TextInputBuilder()
      .setCustomId("mc-version")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("例: 1.20.1")
      .setRequired(false);
    if (defaults?.mcVersion) {
      mcVersionInput.setValue(defaults.mcVersion);
    }

    modal.addLabelComponents(
      new LabelBuilder()
        .setLabel("Minecraft バージョン")
        .setDescription("空の場合、最新版が設定されます")
        .setTextInputComponent(mcVersionInput),
    );

    const panelUsersMenu = new UserSelectMenuBuilder()
      .setCustomId("panel-users")
      .setMinValues(1)
      .setMaxValues(10)
      .setRequired(true);
    if (defaults?.panelUsers && defaults.panelUsers.length > 0) {
      panelUsersMenu.setDefaultUsers(...defaults.panelUsers);
    }

    modal.addLabelComponents(
      new LabelBuilder()
        .setLabel("パネル権限を付与する人")
        .setUserSelectMenuComponent(panelUsersMenu),
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

  /**
   * 日付と企画名を解析する
   * @param input "日付 企画名" 形式の文字列
   * @returns { eventDate: Date | undefined, name: string }
   */
  private static _parseNameWithDate(input: string): {
    eventDate?: Date;
    name: string;
  } {
    const match = input.match(
      /^((?:\d{4}[-/])?\d{1,2}[-/]\d{1,2})[\s\u3000]+(.+)$/,
    );
    if (!match) {
      // 日付が含まれていない場合、そのまま企画名として扱う
      return { name: input };
    }

    const [, dateStr, eventName] = match;
    const parts = dateStr.split(/[-/]/);

    let year: number;
    let month: number;
    let day: number;

    if (parts.length === 2) {
      // MM/DD 形式
      month = Number.parseInt(parts[0], 10);
      day = Number.parseInt(parts[1], 10);

      // 今年として解釈
      const now = new Date();
      year = now.getFullYear();

      // 過去の日付になる場合、来年にする
      const eventDate = new Date(year, month - 1, day);
      if (eventDate < now) {
        year += 1;
      }
    } else if (parts.length === 3) {
      // YYYY/MM/DD 形式
      year = Number.parseInt(parts[0], 10);
      month = Number.parseInt(parts[1], 10);
      day = Number.parseInt(parts[2], 10);
    } else {
      // 不正な形式の場合、企画名として扱う
      return { name: input };
    }

    const eventDate = new Date(year, month - 1, day);

    // 日付が有効かチェック
    if (
      Number.isNaN(eventDate.getTime()) ||
      eventDate.getMonth() !== month - 1
    ) {
      // 無効な日付の場合、企画名として扱う
      return { name: input };
    }

    return { eventDate, name: eventName };
  }

  /**
   * モーダルフィールドを抽出し、バリデーションを行う。
   * バリデーション失敗時はエラーメッセージを送信し null を返す。
   */
  protected async extractFields(
    interaction: ModalSubmitInteraction,
  ): Promise<BaseWorkflowParams | null> {
    const nameInput = interaction.fields.getTextInputValue("name");
    const description = interaction.fields.getTextInputValue("description");
    const mcVersion = interaction.fields.getTextInputValue("mc-version");
    const periodStr = interaction.fields.getTextInputValue("period");

    // 日付と企画名をパース
    const { eventDate, name } =
      WorkflowBaseCheckoutModal._parseNameWithDate(nameInput);

    const panelUsersField = interaction.fields.fields.get("panel-users");
    const panelUsers =
      panelUsersField && "values" in panelUsersField
        ? (panelUsersField.values as string[])
        : [];

    if (mcVersion && !semver.valid(mcVersion)) {
      await interaction.editReply(
        "Minecraft バージョンの形式が正しくありません (例: 1.20.1)。空の場合は最新版が適用されます。",
      );
      return null;
    }

    const period = Number.parseInt(periodStr, 10);
    if (Number.isNaN(period) || period <= 0) {
      await interaction.editReply("貸出期間は正の整数で入力してください。");
      return null;
    }

    if (panelUsers.length === 0) {
      await interaction.editReply(
        "パネル権限付与対象ユーザーを1人以上指定してください。",
      );
      return null;
    }

    return {
      name,
      description: description || undefined,
      mcVersion: mcVersion || undefined,
      periodDays: period,
      panelUsers,
      eventDate,
    };
  }

  /** バリデーション通過後の実行ロジック（サブクラスで実装） */
  protected abstract execute(
    interaction: ModalSubmitInteraction,
    fields: BaseWorkflowParams,
  ): Promise<void>;

  public override async run(interaction: ModalSubmitInteraction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const fields = await this.extractFields(interaction);
    if (!fields) return;

    await this.execute(interaction, fields);
  }
}
