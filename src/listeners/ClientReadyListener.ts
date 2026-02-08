import { ApplyOptions } from "@sapphire/decorators";
import { Events, Listener } from "@sapphire/framework";
import { notificationBoardService } from "@/domain/services/NotificationBoardService";

/**
 * BOT起動時に通知チャンネルに全部確認ボードを作成する
 */
@ApplyOptions<Listener.Options>({
  name: Events.ClientReady,
  event: Events.ClientReady,
  once: true, // BOT起動時に1回だけ実行
})
export class ClientReadyListener extends Listener {
  public override async run() {
    this.container.logger.info(
      "BOTが起動しました。全部確認ボードを作成します。",
    );
    await notificationBoardService.updateBoard(this.container.client);
    this.container.logger.info("全部確認ボードを作成しました。");
  }
}
