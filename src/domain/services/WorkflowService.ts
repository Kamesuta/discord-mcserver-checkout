import {
  type ServerBinding,
  type Workflow,
  type WorkflowPanelUser,
  WorkflowStatus,
} from "@/generated/prisma/client";
import { prisma } from "@/utils/prisma";

/** panelUsers を含む Workflow 型 */
export type WorkflowWithUsers = Workflow & {
  panelUsers: WorkflowPanelUser[];
};

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
  public async create(params: CreateWorkflowParams): Promise<Workflow> {
    return await prisma.workflow.create({
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
          create: params.panelUsers.map((discordId) => ({ discordId })),
        },
      },
      include: {
        panelUsers: true,
      },
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
  ): Promise<WorkflowWithUsers> {
    return await prisma.$transaction(async (tx) => {
      await tx.workflowPanelUser.deleteMany({
        where: { workflowId: params.id },
      });

      return await tx.workflow.update({
        where: { id: params.id },
        data: {
          name: params.name,
          description: params.description ?? null,
          mcVersion: params.mcVersion ?? null,
          periodDays: params.periodDays,
          eventDate: params.eventDate ?? null,
          panelUsers: {
            create: params.panelUsers.map((discordId) => ({ discordId })),
          },
        },
        include: {
          panelUsers: true,
        },
      });
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
}

/** WorkflowService のシングルトンインスタンス */
export const workflowService = new WorkflowService();
