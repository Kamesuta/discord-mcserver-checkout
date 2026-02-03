import {
  type PterodactylUser,
  type ServerBinding,
  type Workflow,
  WorkflowStatus,
} from "@/generated/prisma/client";
import { prisma } from "@/utils/prisma";

/** panelUsers を含む Workflow 型 */
export type WorkflowWithUsers = Workflow & {
  panelUsers: PterodactylUser[];
};

/** create/update の戻り値 */
export interface WorkflowResult<T> {
  workflow: T;
  /** 新規作成された仮ユーザーの Discord ID リスト（未登録通知用） */
  newPanelUsers: string[];
}

/** モーダル入力で収集される申請コンテンツフィールド */
export interface BaseWorkflowParams {
  /** サーバーの用途/企画名 */
  name: string;
  /** 補足説明 */
  description?: string;
  /** 希望 Minecraft バージョン */
  mcVersion?: string;
  /** 貸出希望期間（日数） */
  periodDays: number;
  /** パネル権限付与対象ユーザーの Discord ユーザーIDのリスト */
  panelUsers: string[];
  /** イベント開催日 */
  eventDate?: Date;
}

/** 申請作成パラメータ */
export interface CreateWorkflowParams extends BaseWorkflowParams {
  /** 申請者の Discord ユーザーID */
  applicantDiscordId: string;
  /** 主催者の Discord ユーザーID */
  organizerDiscordId: string;
}

/** 申請ステータス更新パラメータ */
export interface UpdateWorkflowStatusParams {
  /** 申請ID */
  id: number;
  /** 新しいステータス */
  status: WorkflowStatus;
  /** 割り当てられた Pterodactyl サーバーID (ACTIVE時必須) */
  pteroServerId?: string;
  /** 貸出開始日 */
  startDate?: Date;
  /** 貸出終了日 */
  endDate?: Date;
}

/** 申請内容更新パラメータ */
export interface UpdateWorkflowParams extends BaseWorkflowParams {
  /** 申請ID */
  id: number;
}

/**
 * 申請情報を管理するサービスクラス
 */
export class WorkflowService {
  /**
   * 申請を作成する
   * @param params 申請作成パラメータ
   * @returns 作成された申請情報
   */
  public async create(
    params: CreateWorkflowParams,
  ): Promise<WorkflowResult<Workflow>> {
    return await prisma.$transaction(async (tx) => {
      // panelUsers の PterodactylUser を作成（存在しない場合のみ）
      const newPanelUsers = await this._ensurePterodactylUsers(
        tx,
        params.panelUsers,
      );

      const workflow = await tx.workflow.create({
        data: {
          name: params.name,
          description: params.description,
          applicantDiscordId: params.applicantDiscordId,
          organizerDiscordId: params.organizerDiscordId,
          mcVersion: params.mcVersion,
          periodDays: params.periodDays,
          eventDate: params.eventDate,
          status: WorkflowStatus.PENDING,
          panelUsers: {
            connect: params.panelUsers.map((discordId) => ({ discordId })),
          },
        },
        include: {
          panelUsers: true,
        },
      });

      return { workflow, newPanelUsers };
    });
  }

  /**
   * IDから申請を検索する
   * @param id 申請ID
   * @returns 申請情報
   */
  public async findById(id: number): Promise<WorkflowWithUsers | null> {
    return await prisma.workflow.findUnique({
      where: { id },
      include: {
        panelUsers: true,
      },
    });
  }

  /**
   * ステータスから申請を検索する
   * @param status ステータス
   * @returns 申請情報のリスト
   */
  public async findByStatus(
    status: WorkflowStatus,
  ): Promise<WorkflowWithUsers[]> {
    return await prisma.workflow.findMany({
      where: { status },
      include: {
        panelUsers: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  /**
   * 複数のステータスから申請を検索する
   * @param statuses ステータスのリスト
   * @returns 申請情報のリスト
   */
  public async findByStatuses(
    statuses: WorkflowStatus[],
  ): Promise<WorkflowWithUsers[]> {
    return await prisma.workflow.findMany({
      where: { status: { in: statuses } },
      include: {
        panelUsers: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  /**
   * すべての申請を検索する
   * @returns 申請情報のリスト
   */
  public async findAll(): Promise<WorkflowWithUsers[]> {
    return await prisma.workflow.findMany({
      include: {
        panelUsers: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  /**
   * 申請のステータスと割り当て情報を更新する
   * @param params 更新パラメータ
   * @returns 更新された申請情報
   */
  public async updateStatus(
    params: UpdateWorkflowStatusParams,
  ): Promise<Workflow> {
    const data: {
      status: WorkflowStatus;
      pteroServerId?: string;
      startDate?: Date;
      endDate?: Date;
    } = {
      status: params.status,
    };

    if (params.pteroServerId !== undefined) {
      data.pteroServerId = params.pteroServerId;
    }
    if (params.startDate !== undefined) {
      data.startDate = params.startDate;
    }
    if (params.endDate !== undefined) {
      data.endDate = params.endDate;
    }

    return await prisma.workflow.update({
      where: { id: params.id },
      data,
      include: {
        panelUsers: true,
      },
    });
  }

  /**
   * 申請の内容を更新する（PENDING 申請の編集用）
   * @param params 更新パラメータ
   * @returns 更新された申請情報
   */
  public async update(
    params: UpdateWorkflowParams,
  ): Promise<WorkflowResult<WorkflowWithUsers>> {
    return await prisma.$transaction(async (tx) => {
      // 既存の申請情報を取得
      const existingWorkflow = await tx.workflow.findUnique({
        where: { id: params.id },
        include: { panelUsers: true },
      });

      if (!existingWorkflow) {
        throw new Error("申請が見つかりませんでした");
      }

      // 削除されるユーザーを特定
      const oldDiscordIds = existingWorkflow.panelUsers.map((u) => u.discordId);
      const removedDiscordIds = oldDiscordIds.filter(
        (id) => !params.panelUsers.includes(id),
      );

      // 新しい panelUsers の PterodactylUser を作成（存在しない場合のみ）
      const newPanelUsers = await this._ensurePterodactylUsers(
        tx,
        params.panelUsers,
      );

      // Workflow を更新（panelUsers をすべて disconnect してから connect）
      const workflow = await tx.workflow.update({
        where: { id: params.id },
        data: {
          name: params.name,
          description: params.description ?? null,
          mcVersion: params.mcVersion ?? null,
          periodDays: params.periodDays,
          eventDate: params.eventDate ?? null,
          panelUsers: {
            set: params.panelUsers.map((discordId) => ({ discordId })),
          },
        },
        include: {
          panelUsers: true,
        },
      });

      // 削除された PterodactylUser をクリーンアップ
      await this._cleanupUnusedPterodactylUsers(tx, removedDiscordIds);

      return { workflow, newPanelUsers };
    });
  }

  /**
   * 利用可能なサーバー（未割り当てのサーバーバインディング）を検索する
   * @returns 利用可能なサーバーバインディング、なければnull
   */
  public async findAvailableServer(): Promise<ServerBinding | null> {
    const activeWorkflows = await prisma.workflow.findMany({
      where: { status: WorkflowStatus.ACTIVE },
      select: { pteroServerId: true },
    });
    const activeServerIds = activeWorkflows
      .map((w) => w.pteroServerId)
      .filter((id): id is string => id !== null);

    return await prisma.serverBinding.findFirst({
      where: { pteroId: { notIn: activeServerIds } },
    });
  }

  /**
   * PENDING 申請の貸出期間を更新する
   * @param id 申請ID
   * @param periodDays 新しい貸出期間（日数）
   */
  public async updatePeriodDays(
    id: number,
    periodDays: number,
  ): Promise<Workflow> {
    return await prisma.workflow.update({
      where: { id },
      data: { periodDays },
    });
  }

  /**
   * ACTIVE 申請の終了日を更新する
   * @param id 申請ID
   * @param endDate 新しい終了日
   */
  public async updateEndDate(id: number, endDate: Date): Promise<Workflow> {
    return await prisma.workflow.update({
      where: { id },
      data: { endDate },
    });
  }

  /**
   * PterodactylUser が存在しない場合は作成する（registered=false で作成）
   * @param tx トランザクションクライアント
   * @param discordIds Discord ID のリスト
   * @returns 新規作成された Discord ID のリスト
   */
  private async _ensurePterodactylUsers(
    tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
    discordIds: string[],
  ): Promise<string[]> {
    const newPanelUsers: string[] = [];
    for (const discordId of discordIds) {
      const existing = await tx.pterodactylUser.findUnique({
        where: { discordId },
      });
      if (!existing) {
        await tx.pterodactylUser.create({
          data: { discordId, registered: false },
        });
        newPanelUsers.push(discordId);
      }
    }
    return newPanelUsers;
  }

  /**
   * 使用されていない PterodactylUser を削除する
   * registered=false かつ workflows が0件の場合のみ削除
   * @param tx トランザクションクライアント
   * @param discordIds チェック対象の Discord ID のリスト
   */
  private async _cleanupUnusedPterodactylUsers(
    tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
    discordIds: string[],
  ): Promise<void> {
    for (const discordId of discordIds) {
      const user = await tx.pterodactylUser.findUnique({
        where: { discordId },
        include: { workflows: true },
      });

      // registered=false かつ workflows が0件なら削除
      if (user && !user.registered && user.workflows.length === 0) {
        await tx.pterodactylUser.delete({
          where: { discordId },
        });
      }
    }
  }
}

/** WorkflowService のシングルトンインスタンス */
export const workflowService = new WorkflowService();
