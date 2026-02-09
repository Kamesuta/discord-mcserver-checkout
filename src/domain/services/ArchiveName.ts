/**
 * バックアップアーカイブのフォルダ名・ファイル名を構築するクラス
 *
 * フォルダ構造: YYYY/YYYY-MM-DD_ID[ID]_[企画名]_主催者名主催/
 * ファイル名: YYYY-MM-DD_HH-mm[_補足].tar.gz
 */
export class ArchiveName {
  public readonly workflowId: number;
  public readonly workflowName: string;
  public readonly organizerName: string;
  public readonly eventDate: string;
  public readonly mcVersion?: string;
  public readonly folderName: string;

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

    this.workflowId = options.workflowId;
    this.workflowName = options.workflowName;
    this.organizerName = options.organizerName;
    this.eventDate = dateStr;
    this.mcVersion = options.mcVersion;

    const folderNameWithoutYear = `${dateStr}_ID${options.workflowId}_[${sanitizedWorkflowName}]_${sanitizedOrganizerName}主催${mcVersionPart}`;
    this.folderName = `${yyyy}/${folderNameWithoutYear}`;
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

  /**
   * フォルダ名からArchiveNameインスタンスを生成する
   * @param folderName パース対象のフォルダ名（YYYY/YYYY-MM-DD_ID...形式）
   * @returns ArchiveNameインスタンス、パースできない場合はundefined
   */
  static fromFolderName(folderName: string): ArchiveName | undefined {
    // 新形式: YYYY/YYYY-MM-DD_ID[数字]_[企画名]_主催者名主催[_MCバージョン]
    const match = folderName.match(
      /^(\d{4})\/(\d{4}-\d{2}-\d{2})_ID(\d+)_\[(.+?)\]_(.+?)主催(?:_(MC.+))?$/,
    );

    if (!match) {
      return undefined;
    }

    const [
      ,
      ,
      eventDateStr,
      workflowIdStr,
      workflowName,
      organizerName,
      mcVersion,
    ] = match;

    // eventDateStrをDateオブジェクトに変換
    const [year, month, day] = eventDateStr.split("-").map(Number);
    const eventDate = new Date(year, month - 1, day);

    return new ArchiveName({
      workflowId: Number(workflowIdStr),
      workflowName,
      organizerName,
      eventDate,
      mcVersion: mcVersion || undefined,
    });
  }

  /**
   * フォルダ名が指定されたワークフローIDに一致するかチェックする
   * @param folderName チェック対象のフォルダ名
   * @param workflowId ワークフローID
   * @returns 一致する場合はtrue
   */
  static matchesWorkflowId(folderName: string, workflowId: number): boolean {
    const archive = ArchiveName.fromFolderName(folderName);
    return archive?.workflowId === workflowId;
  }
}
