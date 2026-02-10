/**
 * customIdのURLパラメータキー定数
 * Discord customIdの100文字制限対策のため、キー名を短縮
 */
export const customIdParams = {
  /** ワークフローID */
  workflowId: "w",
  /** 主催者Discord ID */
  organizerId: "o",
  /** 申請者Discord ID */
  applicantId: "a",
  /** サーバーリセットをスキップ */
  skipReset: "sr",
  /** サーバー名 */
  serverName: "s",
  /** ユーザーIDリスト（カンマ区切り） */
  users: "u",
  /** アーカイブをスキップ */
  skipArchive: "sa",
} as const;
