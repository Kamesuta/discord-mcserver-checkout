/**
 * 日付文字列をパースする
 * WorkflowBaseModal._parseNameWithDate を参考に実装
 *
 * @param dateStr 日付文字列 (MM/DD または YYYY/MM/DD 形式)
 * @returns パースされた Date オブジェクト、失敗時は null
 */
export function parseDate(dateStr: string): Date | null {
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
    const eventDate = new Date(year, month - 1, day + 1);
    if (eventDate < now) {
      year += 1;
    }
  } else if (parts.length === 3) {
    // YYYY/MM/DD 形式
    year = Number.parseInt(parts[0], 10);
    month = Number.parseInt(parts[1], 10);
    day = Number.parseInt(parts[2], 10);
  } else {
    // 不正な形式
    return null;
  }

  const date = new Date(year, month - 1, day);

  // 日付が有効かチェック（月の範囲チェックを含む）
  if (Number.isNaN(date.getTime()) || date.getMonth() !== month - 1) {
    return null;
  }

  return date;
}
