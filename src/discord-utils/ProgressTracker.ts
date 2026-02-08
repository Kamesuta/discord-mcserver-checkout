import type { ButtonInteraction, ModalSubmitInteraction } from "discord.js";

/**
 * Discord インタラクションで進捗を表示するユーティリティクラス
 * @template Step ステップの型（例: "stop" | "archive" | "reset"）
 */
export class ProgressTracker<Step extends string> {
  private readonly _interaction: ButtonInteraction | ModalSubmitInteraction;
  private readonly _title: string;
  private readonly _stepLabels: Record<Step, string>;
  private readonly _steps: Step[];
  private readonly _completedSteps: Set<Step>;
  private _lastContent?: string;
  private _currentStep?: Step;

  /**
   * @param interaction インタラクション（deferReply済み）
   * @param title 進捗表示のタイトル（例: "返却処理中"）
   * @param stepLabels ステップのラベルマップ
   * @param steps 実行するステップの配列
   */
  constructor(
    interaction: ButtonInteraction | ModalSubmitInteraction,
    title: string,
    stepLabels: Record<Step, string>,
    steps: Step[],
  ) {
    this._interaction = interaction;
    this._title = title;
    this._stepLabels = stepLabels;
    this._steps = steps;
    this._completedSteps = new Set();
  }

  /**
   * 進捗を表示する（現在の完了状態で）
   */
  async update(): Promise<void> {
    const lines = this._steps.map((step) => {
      let icon: string;
      if (this._completedSteps.has(step)) {
        icon = "✅";
      } else if (this._currentStep === step) {
        icon = "⏩";
      } else {
        icon = "⬜️";
      }
      return `${icon} ${this._stepLabels[step]}`;
    });

    const content = `${this._title}・・・(${this._completedSteps.size}/${this._steps.length}完了)\n${lines.join("\n")}`;

    // 前回と同じ内容ならスキップ
    if (this._lastContent === content) {
      return;
    }

    this._lastContent = content;
    await this._interaction.editReply(content);
  }

  /**
   * ステップを完了としてマークし、進捗を更新する
   * @param step 完了したステップ
   */
  async complete(step: Step): Promise<void> {
    this._completedSteps.add(step);
    await this.update();
  }

  /**
   * ステップの実行を行い、完了後に進捗を更新する
   * @param step 実行するステップ
   * @param fn 実行する非同期関数
   */
  async execute<T>(step: Step, fn: () => Promise<T>): Promise<T> {
    this._currentStep = step;
    await this.update();
    const result = await fn();
    this._completedSteps.add(step);
    this._currentStep = undefined;
    await this.update();
    return result;
  }
}
