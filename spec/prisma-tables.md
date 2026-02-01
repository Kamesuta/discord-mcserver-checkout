# Prisma テーブル設計

既存の `ServerBinding` テーブルに追加する3モデルと1enum。

---

## ER 関係の概要

```
Workflow 1 ──── * WorkflowPanelUser
     │                   │
     │                   │ (discordId で JOIN、FK なし)
     ▼                   ▼
(割り当てサーバー)    PterodactylUser
```

- 1つの申請には複数のパネル権限付与対象ユーザーが対応する
- `PterodactylUser` は Discord ユーザーと Pterodactyl ユーザーの対応テーブルで、申請に関係なく再利用される
- `WorkflowPanelUser.discordId` と `PterodactylUser.discordId` で JOIN し、Pterodactyl のユーザー名・メールアドレスを取得する

### `WorkflowPanelUser` は明示的に定義する必要がある

見た目上 `Workflow` と `PterodactylUser` の ManyToMany 中間テーブルに見えるが、Prisma の implicit ManyToMany（中間テーブル自動生成）は使えない。

理由: 申請時点で `PterodactylUser` がまだ存在しないため。パネル権限付与対象ユーザーの Pterodactyl アカウントは承認フロー（`workflow approve`）で初回作成される。Prisma の implicit ManyToMany は両側への FK を持つ中間テーブルを生成するため、`PterodactylUser` が未登録の Discord ID を挿入できない。

したがって `WorkflowPanelUser` は明示的に定義し、`discordId` は `PterodactylUser` への FK ではなく単なる `String` とする。

---

## 追加するスキーマ

```prisma
enum WorkflowStatus {
  /// 承認待ち
  PENDING
  /// 否決
  REJECTED
  /// 貸出中（サーバー割り当て済み）
  ACTIVE
  /// 返却済み
  RETURNED
}

/// 申請情報を管理するテーブル
/// id は バックアップ保存先パスの識別子としても使用される
model Workflow {
  /// ワークフロー ID（バックアップ命名にも使用）
  id                  Int                  @id @default(autoincrement())
  /// 申請者の Discord ユーザーID
  applicantDiscordId  String
  /// サーバーの説明/用途（企画名）
  description         String
  /// 希望 Minecraft バージョン
  mcVersion           String
  /// 貸出希望期間（日数）
  periodDays          Int
  /// 主催者の Discord ユーザーID
  organizerDiscordId  String
  /// 申請ステータス
  status              WorkflowStatus       @default(PENDING)
  /// Pterodactyl サーバーID（割り当て後に埋まる）
  pteroServerId       String?
  /// 貸出開始日（割り当て後に埋まる）
  startDate           DateTime?
  /// 貸出終了日（割り当て後に埋まる）
  endDate             DateTime?
  /// 作成日時
  createdAt           DateTime             @default(now())
  /// 更新日時
  updatedAt           DateTime             @updatedAt

  /// パネル権限付与対象ユーザー一覧
  panelUsers          WorkflowPanelUser[]
}

/// 申請ごとのパネル権限付与対象ユーザー
/// 1つの申請に複数のユーザーが対応する
/// PterodactylUser への FK を持たない（申請時点で未登録の場合がある）
model WorkflowPanelUser {
  /// 主キー
  id          Int      @id @default(autoincrement())
  /// ワークフロー ID
  workflowId  Int
  /// パネル権限付与対象ユーザーの Discord ユーザーID
  discordId   String

  /// Workflow への関連
  workflow    Workflow @relation(fields: [workflowId], references: [id])
}

/// Discord ユーザーと Pterodactyl ユーザーの対応付け
/// 承認フローで初回登録時に作成され、以降の申請で再利用される
model PterodactylUser {
  /// Discord ユーザーID（主キー）
  discordId  String    @id
  /// Pterodactyl ユーザー名
  username   String    @unique
  /// メールアドレス (username@kpw.local)
  email      String    @unique
  /// 登録日時
  createdAt  DateTime  @default(now())
}
```

---

## テーブルの役割まとめ

| テーブル | 役割 | 主なアクセスパターン |
|---|---|---|
| `Workflow` | 申請の一生を管理（PENDING → ACTIVE → RETURNED） | ステータス別検索、ID検索 |
| `WorkflowPanelUser` | 申請とパネル権限付与対象ユーザーの対応を管理 | ワークフロー ID で一覧取得 |
| `PterodactylUser` | Discord ID ↔ Pterodactyl ユーザー名 の永続的対応 | Discord ID で検索（存在確認・JOIN） |

---

## 既存テーブルとの関連

| 既存テーブル | 新規テーブルとの関係 |
|---|---|
| `ServerBinding` | 割り当て時に使用。`ServerBinding` に登録されたサーバーのうち、いずれの ACTIVE `Workflow` にも割り当てられていないサーバーが新規割り当て対象になる |
