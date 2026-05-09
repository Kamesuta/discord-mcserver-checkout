import { randomUUID } from "node:crypto";
import type { BaseWorkflowParams } from "@/domain/services/WorkflowService";

/** 流用時のサーバーファイル保持モード */
export type ReuseFileMode = "reset" | "keep";

/**
 * 流用確認前の一時入力内容
 *
 * DBに仮申請を作らず、確認ボタンを押すまでメモリ上に保持する。
 * これにより、確認画面を閉じただけで PENDING 申請が増えることを防ぐ。
 */
export interface ReuseDraft {
  /** 元のACTIVEワークフローID */
  sourceWorkflowId: number;
  /** 実行者Discord ID */
  applicantDiscordId: string;
  /** 主催者Discord ID（流用では変更不可） */
  organizerDiscordId: string;
  /** 新企画として入力された内容 */
  fields: BaseWorkflowParams;
  /** サーバーファイルの保持設定 */
  fileMode: ReuseFileMode;
  /** 初回実行時に作成された新ワークフローID（再試行用） */
  createdWorkflowId?: number;
  /** 有効期限 */
  expiresAt: number;
}

/**
 * 流用確認用ドラフトを管理するサービス
 */
class ReuseDraftService {
  /** 確認待ちドラフトを保持するメモリマップ */
  private readonly _drafts = new Map<string, ReuseDraft>();

  /** ドラフトの有効時間（15分） */
  private readonly _ttlMs = 15 * 60 * 1000;

  /**
   * ドラフトを作成する
   * @returns 確認ボタンに埋め込むトークン
   */
  public create(draft: Omit<ReuseDraft, "expiresAt">): string {
    this._cleanupExpired();

    const token = randomUUID().slice(0, 8);
    this._drafts.set(token, {
      ...draft,
      expiresAt: Date.now() + this._ttlMs,
    });
    return token;
  }

  /**
   * トークンからドラフトを取得する
   */
  public get(token: string): ReuseDraft | undefined {
    this._cleanupExpired();

    const draft = this._drafts.get(token);
    if (!draft) {
      return undefined;
    }

    if (draft.expiresAt < Date.now()) {
      this._drafts.delete(token);
      return undefined;
    }

    return draft;
  }

  /**
   * 生成済みワークフローIDを紐づける
   */
  public setCreatedWorkflowId(token: string, workflowId: number): void {
    const draft = this.get(token);
    if (!draft) {
      return;
    }
    this._drafts.set(token, {
      ...draft,
      createdWorkflowId: workflowId,
    });
  }

  /**
   * 完了済みドラフトを破棄する
   */
  public delete(token: string): void {
    this._drafts.delete(token);
  }

  /**
   * 期限切れドラフトを掃除する
   */
  private _cleanupExpired(): void {
    const now = Date.now();
    for (const [token, draft] of this._drafts.entries()) {
      if (draft.expiresAt < now) {
        this._drafts.delete(token);
      }
    }
  }
}

export const reuseDraftService = new ReuseDraftService();
