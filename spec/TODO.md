# 実装 TODO 一覧

要件定義書に基づき、既存実装との差分から導出した開発タスク。

---

## Phase 1: データ基盤

- [ ] Prisma テーブル追加 (`prisma/schema.prisma`)
  - `WorkflowStatus` enum
  - `Workflow` モデル
  - `WorkflowPanelUser` モデル
  - `PterodactylUser` モデル (Discord ↔ Pterodactyl ユーザー対応)
  - マイグレーション実行
- [ ] 新規環境変数の追加 (`src/utils/env.ts`)
  - `DISCORD_PANEL_USER_ROLE_ID` — パネル権限付与対象ユーザーに付与するDiscordロールID
  - `RCLONE_REMOTE` — rcloneリモート名 (例: `gdrive:`)
  - `RCLONE_BASE_PATH` — Google Driveの保存先ベースパス (例: `企画鯖ワールドデータ`)
- [ ] `PterodactylBackupService` にロック操作を追加
  - `toggleLock(serverId, backupUuid)` — `POST .../backups/{uuid}/toggle-lock`
- [ ] `PterodactylService` にサーバー再インストール機能を追加
  - `reinstallServer(serverId)` — `POST .../servers/{id}/reinstall`

---

## Phase 2: 申請フロー

- [ ] `WorkflowService` を作成 (`src/domain/services/WorkflowService.ts`)
  - `create(...)` — 申請の挿入
  - `findById(id)` — ID検索
  - `findByStatus(status)` — ステータス検索
  - `updateStatus(id, status, ...)` — ステータス・割り当て情報の更新
- [ ] `/mcserver` コマンド実装 (`src/commands/mcserver.ts`)
  - `/mcserver checkout` — モーダルフォーム表示（5項目の入力）→ DB記録 → 申請受付通知
  - `/mcserver reset_password` — 実行者の Discord ID から `PterodactylUser` を検索し、パスワードリセット

---

## Phase 3: 承認・割り当てフロー

- [ ] `/mcserver_admin workflow list` コマンド実装
  - PENDING の申請一覧を Embed で表示
- [ ] `/mcserver_admin workflow approve` コマンド実装（インタラクティブフロー）
  1. 申請内容を表示
  2. パネル権限付与対象ユーザーの Pterodactyl 登録確認
  3. 未登録がある場合 → モーダルでユーザー名入力 → `registerUser` + DB保存
  4. パネル権限付与対象ユーザーに Discord ロール付与（未付与の場合のみ）
  5. `ServerBinding` に登録されて未割り当て（いずれの ACTIVE Workflow にも割り当てられていない）のサーバーを検索して割り当て
  6. パネルにユーザー追加・権限付与 (`addUser`)
  7. ステータスを `ACTIVE` に更新（開始日・終了日・サーバーID を記録）
  8. パネル権限付与対象ユーザー・主催者へ通知

---

## Phase 4: 貸出管理

- [ ] `/mcserver_admin checkout list` コマンド実装
  - ACTIVE の貸出一覧を Embed で表示（サーバーID、主催者、期限、残り日数等）
- [ ] `/mcserver_admin checkout extend` コマンド実装
  - `id` と日付を受け取り、ステータスに応じた動作：
    - PENDING: `periodDays` を上書き（承認前に期間を調整する場合に使用）
    - ACTIVE: `endDate` を指定日付に設定

---

## Phase 5: 返却フロー

- [ ] rclone アップロード用ユーティリティを作成 (`src/utils/rclone.ts`)
  - ローカルファイルを `RCLONE_REMOTE` + `RCLONE_BASE_PATH` 配下に転送
- [ ] `ReturnService` を作成 (`src/domain/services/ReturnService.ts`)
  - バックアップ選択サジェスト（最新バックアップ + ロック済みバックアップ）
  - バックアップダウンロード → rclone アップロード
  - 全ロック済みバックアップのロック解除
  - サーバー再インストール（初期化）
  - パネル権限付与対象ユーザーの権限剥奪（`WorkflowPanelUser` に記録されたユーザーを対象）
  - ステータスを `RETURNED` に更新
  - 主催者・パネル権限付与対象ユーザーへ返却通知
- [ ] `/mcserver_admin checkout return` コマンド実装（インタラクティブフロー）
  1. 申請情報・バックアップ一覧を表示
  2. Select Menu でバックアップを選択
  3. モーダルで日付・補足コメントを入力
  4. `ReturnService` を呼び出し返却処理実行

---

## Phase 6: 自動タスク

- [ ] スケジューラー基盤を作成 (`src/services/Scheduler.ts` など)
  - Bot起動時に開始、定期実行（例: 1時間ごと）
- [ ] リマインド通知タスク
  - 期限 3 日前・1 日前の ACTIVE 貸出を検出
  - 主催者に期限切れ予定の通知を送信
- [ ] 自動返却タスク
  - 期限切れ（`endDate` が過去）の ACTIVE 貸出を検出
  - 管理者に返却処理の開始通知を送信 → バックアップ選択フローを開始
