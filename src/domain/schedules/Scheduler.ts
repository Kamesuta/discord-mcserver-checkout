import type { SapphireClient } from "@sapphire/framework";
import schedule from "node-schedule";
import { sapphireLogger } from "../../utils/log.js";

/** スケジュールされたタスクのインターフェース */
export interface ScheduledTask {
  /** タスク名 */
  name: string;
  /** タスクの実行関数 */
  execute: (client: SapphireClient) => Promise<void>;
}

/**
 * 定期実行タスクを管理するスケジューラークラス
 * node-scheduleを使用して1時間ごとにタスクを実行
 */
export class Scheduler {
  private _tasks: ScheduledTask[] = [];
  private _job: schedule.Job | null = null;
  private _isRunning = false;

  /**
   * @param _client Discord Botクライアント
   * @param _cronExpression cron形式のスケジュール式
   */
  constructor(
    private _client: SapphireClient,
    private _cronExpression: string,
  ) {}

  /**
   * タスクを登録する
   * @param task 登録するタスク
   */
  public registerTask(task: ScheduledTask): void {
    this._tasks.push(task);
    sapphireLogger.info(`Scheduled task registered: ${task.name}`);
  }

  /**
   * スケジューラーを開始する
   */
  public start(): void {
    if (this._isRunning) {
      sapphireLogger.warn("Scheduler is already running");
      return;
    }

    sapphireLogger.info(
      `Starting scheduler with cron expression: ${this._cronExpression}`,
    );

    // 定期実行を開始
    this._job = schedule.scheduleJob(this._cronExpression, () => {
      this._runTasks();
    });

    this._isRunning = true;
    sapphireLogger.info("Scheduler started successfully");
  }

  /**
   * スケジューラーを停止する
   */
  public stop(): void {
    if (this._job) {
      this._job.cancel();
      this._job = null;
    }
    this._isRunning = false;
    sapphireLogger.info("Scheduler stopped");
  }

  /**
   * 登録された全タスクを実行する
   */
  private async _runTasks(): Promise<void> {
    sapphireLogger.info(`Running ${this._tasks.length} scheduled tasks`);

    for (const task of this._tasks) {
      try {
        sapphireLogger.debug(`Executing task: ${task.name}`);
        await task.execute(this._client);
        sapphireLogger.debug(`Task completed: ${task.name}`);
      } catch (error) {
        sapphireLogger.error(`Error executing task ${task.name}:`, error);
      }
    }
  }
}
