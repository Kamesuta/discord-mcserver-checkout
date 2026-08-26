import { ServerType } from "@/generated/prisma/client";

/** サーバー種別の表示ラベル */
export const serverTypeLabels: Record<ServerType, string> = {
  [ServerType.SERVER]: "通常鯖",
  [ServerType.MOD]: "Mod鯖",
};

/**
 * バージョン入力欄の文字列から、サーバー種別と Minecraft バージョンを分離する。
 * 「mod」(大小文字不問) が含まれていたら Mod鯖 とみなし、バージョン部分だけを取り出す。
 * 取り出したバージョンは Pterodactyl の MINECRAFT_VERSION にそのまま渡されるため、
 * 「Forge」などの余計な語が混ざらないよう数字のみのトークンを抽出する。
 *
 * 例: "1.7.10 Mod" / "26.2MOD" / "Mod1.20.1" / "mod 1.16.5" / "1.20.1 Forge Mod"
 * @param input バージョン入力欄の値
 */
export function parseMcVersionInput(input: string): {
  serverType: ServerType;
  /** 抽出した Minecraft バージョン (未指定の場合は undefined) */
  mcVersion?: string;
} {
  const serverType = /mod/i.test(input) ? ServerType.MOD : ServerType.SERVER;
  // 「1.20.1」「1.21」「26.2」のようなバージョン表記を抽出する
  const mcVersion = input.match(/\d+(?:\.\d+)*/)?.[0];
  return { serverType, mcVersion };
}

/**
 * 種別とバージョンを、バージョン入力欄に復元できる文字列に戻す。
 * 編集・流用モーダルのデフォルト値として使う。
 * @param mcVersion Minecraft バージョン
 * @param serverType サーバー種別
 */
export function formatMcVersionInput(
  mcVersion: string | null | undefined,
  serverType: ServerType,
): string | undefined {
  if (serverType === ServerType.MOD) {
    return mcVersion ? `${mcVersion} Mod` : "Mod";
  }
  return mcVersion ?? undefined;
}
