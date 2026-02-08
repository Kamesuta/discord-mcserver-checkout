/**
 * ガントチャートの表示設定
 */
export interface GanttView {
  start: Date;
  end: Date;
  today: Date;
}

/**
 * タスクデータ
 */
export interface GanttTask {
  id: string;
  name: string;
  start: Date;
  end: Date;
}

/**
 * テキストベースのガントチャートを生成・管理するクラス
 */
export class GanttChart {
  /** 表示設定（開始日、終了日、基準となる今日の日付） */
  private _view: GanttView;
  /** 管理対象のタスクリスト */
  private _tasks: GanttTask[] = [];

  /**
   * @param start チャートの表示開始日
   * @param end チャートの表示終了日
   * @param today 「今日」として扱う日付（デフォルトはシステム時刻）
   */
  constructor(start: Date, end: Date, today: Date = new Date()) {
    // 内部で扱う日付はすべて「時刻 00:00:00」に統一することで、
    // 日付の純粋な比較（===）を可能にしています。
    this._view = {
      start: this._normalizeDate(start),
      end: this._normalizeDate(end),
      today: this._normalizeDate(today),
    };
  }

  /**
   * チャートに新しいタスクを追加します。
   * 入力された日付は自動的に時刻リセット処理が行われます。
   */
  public addTask(task: GanttTask): void {
    this._tasks.push({
      ...task,
      start: this._normalizeDate(task.start),
      end: this._normalizeDate(task.end),
    });
  }

  /**
   * 現在保持しているタスクと設定に基づき、ガントチャートの文字列を生成します。
   * @returns レンダリングされたテキスト
   */
  public render(): string {
    // 1. 準備：表示期間内の全日付リストを生成
    const dates = this._generateDateRange();

    // 2. レイアウト計算：タスク名の最大幅を計算（最低10文字分は確保）
    // getVisualWidthを使用して全角文字を2文字としてカウントします。
    const nameWidth = Math.max(
      10,
      ...this._tasks.map((t) => this._getVisualWidth(t.name)),
    );

    // 左側の固定エリア幅を計算 (ステータス絵文字 + ID + スペース + 名前)
    const sidePaddingWidth = 2 + 2 + 3 + nameWidth;

    let result = "";

    // --- セクション1: 「今日」マーカーの描画 ---
    // 「今日」が表示期間内に含まれているかチェック
    const todayIdx = dates.findIndex(
      (d) => d.getTime() === this._view.today.getTime(),
    );
    if (todayIdx !== -1) {
      // 1日付につき3文字スペースを確保しているため、インデックスに3を掛けます
      const markerPos = sidePaddingWidth + todayIdx * 3 + 1;
      result += `${" ".repeat(Math.max(0, markerPos - 2))}今日￬\n`;
    } else {
      result += "\n"; // 範囲外の場合は空行
    }

    // --- セクション2: ヘッダー（日付行）の描画 ---
    let header = `   ID  ${this._padRight("Name", nameWidth)}`;
    dates.forEach((d) => {
      // 日付の数字を右詰めで3文字分確保（例: " 1", "15"）
      header += d.getDate().toString().padStart(3, " ");
    });
    // ヘッダー下部に区切り線を引く（全角考慮の幅で）
    result += `${header}\n${"-".repeat(this._getVisualWidth(header))}\n`;

    // --- セクション3: 各タスク行の描画 ---
    this._tasks.forEach((t) => {
      // 期限切れチェック：今日が終了日を過ぎていたら❌、そうでなければ✅
      const isOverdue = this._view.today > t.end;
      const status = isOverdue ? "❌" : "✅";

      // 行の左側部分（ステータス、ID、名前）を構築
      let row = `${status} ${t.id.padEnd(2)}  ${this._padRight(t.name, nameWidth)}`;

      // 各日付について、タスクの期間内かどうかを判定して文字を割り当て
      dates.forEach((d) => {
        const time = d.getTime();
        const start = t.start.getTime();
        const end = t.end.getTime();

        if (time === start && time === end) {
          row += " []"; // 1日で終わるタスク（特殊ケース）
        } else if (time === start) {
          row += "  ["; // 開始日
        } else if (time === end) {
          row += "==]"; // 終了日
        } else if (time > start && time < end) {
          row += "==="; // 期間中
        } else {
          row += "  ."; // 期間外
        }
      });
      result += `${row}\n`;
    });

    return result;
  }

  /**
   * 日付オブジェクトの時刻部分を 00:00:00.000 にリセットします。
   * 非破壊的な処理のため、新しいDateオブジェクトを返します。
   */
  private _normalizeDate(d: Date): Date {
    const newDate = new Date(d);
    newDate.setHours(0, 0, 0, 0);
    return newDate;
  }

  /**
   * 開始日から終了日までのDateオブジェクトを配列にして返します。
   */
  private _generateDateRange(): Date[] {
    const dates: Date[] = [];
    // ループ用のポインタを作成
    const current = new Date(this._view.start);
    while (current <= this._view.end) {
      dates.push(new Date(current));
      current.setDate(current.getDate() + 1); // 1日進める
    }
    return dates;
  }

  /**
   * 文字列の視覚的な幅を計算します。
   * 半角文字は1、それ以外（全角など）は2としてカウントします。
   */
  private _getVisualWidth(s: string): number {
    return [...s].reduce(
      (acc, char) => (char.match(/[^\x20-\xff]/) ? acc + 2 : acc + 1),
      0,
    );
  }

  /**
   * 視覚的な幅を考慮して、右側にスペースを詰め（パディング）ます。
   */
  private _padRight(s: string, width: number): string {
    const currentWidth = this._getVisualWidth(s);
    // 足りない分だけスペースを追加
    return s + " ".repeat(Math.max(0, width - currentWidth));
  }
}
