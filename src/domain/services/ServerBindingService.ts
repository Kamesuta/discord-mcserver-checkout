import { prisma } from "@/utils/prisma";

/**
 * ServerBindingサービス
 * エイリアスとPterodactyl IDの対応付けを管理
 */
class ServerBindingService {
  /**
   * すべてのサーバーバインディングを取得
   */
  async list() {
    return await prisma.serverBinding.findMany({
      orderBy: { name: "asc" },
    });
  }

  /**
   * エイリアスからPterodactyl IDを取得
   * @param name エイリアス (例: server01)
   * @returns Pterodactyl ID、見つからない場合はnull
   */
  async getPteroId(name: string): Promise<string | null> {
    const binding = await prisma.serverBinding.findUnique({
      where: { name },
    });
    return binding?.pteroId ?? null;
  }

  /**
   * エイリアスとPterodactyl IDの対応付けを設定
   * @param name エイリアス (例: server01)
   * @param pteroId Pterodactyl ID (例: 354dc039)
   */
  async set(name: string, pteroId: string) {
    return await prisma.serverBinding.upsert({
      where: { name },
      update: { pteroId },
      create: { name, pteroId },
    });
  }

  /**
   * エイリアスの対応付けを削除
   * @param name エイリアス (例: server01)
   */
  async unset(name: string) {
    return await prisma.serverBinding.delete({
      where: { name },
    });
  }

  /**
   * サーバー名からPterodactyl IDを解決
   * Bindingに登録されていない場合はエラーを投げる
   * @param name サーバー名 (例: server01)
   * @returns Pterodactyl ID
   * @throws サーバー名が登録されていない場合
   */
  async resolve(name: string): Promise<string> {
    const pteroId = await this.getPteroId(name);
    if (!pteroId) {
      throw new Error(`サーバー名 \`${name}\` は登録されていません。`);
    }
    return pteroId;
  }

  /**
   * Pterodactyl IDからエイリアスを取得
   * @param pteroId Pterodactyl ID (例: 354dc039)
   * @returns エイリアス、見つからない場合はnull
   */
  async getName(pteroId: string): Promise<string | null> {
    const binding = await prisma.serverBinding.findFirst({
      where: { pteroId },
    });
    return binding?.name ?? null;
  }
}

export const serverBindingService = new ServerBindingService();
