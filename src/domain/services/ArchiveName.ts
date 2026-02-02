/**
 * バックアップアーカイブのフォルダ名・ファイル名を構築するクラス
 *
 * フォルダ構造: [ID]_YYYYMMdd_企画名_主催者名主催/
 * ファイル名: YYYYMMdd_HHmmss[_補足].tar.gz
 */
export class ArchiveName {
  private _folderName: string;

  constructor(options: {
    workflowId: number;
    workflowName: string;
    organizerName: string;
    eventDate: Date;
    mcVersion?: string;
  }) {
    const yyyy = options.eventDate.getFullYear();
    const mm = String(options.eventDate.getMonth() + 1).padStart(2, "0");
    const dd = String(options.eventDate.getDate()).padStart(2, "0");
    const dateStr = `${yyyy}-${mm}-${dd}`;

    const sanitizedWorkflowName = this._sanitizePath(options.workflowName);
    const sanitizedOrganizerName = this._sanitizePath(options.organizerName);
    const mcVersionPart = options.mcVersion ? `_MC${options.mcVersion}` : "";

    this._folderName = `ID${options.workflowId}_[${sanitizedWorkflowName}]_${dateStr}_${sanitizedOrganizerName}主催${mcVersionPart}`;
  }

  /**
   * パスとして使用できない文字を除去・置換する
   * 空白は「-」に置き換え、ファイルシステムで使用できない文字を除去
   */
  private _sanitizePath(value: string): string {
    // 空白を - に置き換える
    let sanitized = value.replace(/\s+/g, "-");
    // ファイルシステムで使用できない文字を除去（Windows と Unix 両対応）
    sanitized = sanitized.replace(/[<>:"/\\|?*]/g, "");
    // 制御文字を除去
    sanitized = sanitized
      .split("")
      .filter((char) => char.charCodeAt(0) >= 0x20)
      .join("");
    return sanitized;
  }

  /**
   * フォルダ名を取得
   */
  getFolderName(): string {
    return this._folderName;
  }

  /**
   * バックアップのファイル名を取得
   * @param backupCreatedAt バックアップの作成日時（ISO 8601 形式）
   * @param backupSupplement ファイル名の補足（バックアップ名またはコメント）
   */
  getFileName(backupCreatedAt: string, backupSupplement?: string): string {
    const dateStr = this._formatBackupDate(backupCreatedAt);
    const supplementPart = backupSupplement ? `[${backupSupplement}]_` : "";
    return `${supplementPart}${dateStr}.tar.gz`;
  }

  /**
   * バックアップの日付を YYYYMMdd_HHmmss 形式で取得（内部用）
   */
  private _formatBackupDate(createdAt: string): string {
    const date = new Date(createdAt);
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    const hh = String(date.getHours()).padStart(2, "0");
    const mi = String(date.getMinutes()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}_${hh}-${mi}`;
  }
}
