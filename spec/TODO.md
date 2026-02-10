# 実装 TODO 一覧

要件定義書に基づき、既存実装との差分から導出した開発タスク。

---

## Phase 1: データ基盤

- [x] Prisma テーブル追加 (`prisma/schema.prisma`)
  - `WorkflowStatus` enum
  - `Workflow` モデル
  - `WorkflowPanelUser` モデル
  - `PterodactylUser` モデル (Discord ↔ Pterodactyl ユーザー対応)
  - マイグレーション実行
- [x] 新規環境変数の追加 (`src/utils/env.ts`)
  - `DISCORD_PANEL_USER_ROLE_ID` — パネル権限付与対象ユーザーに付与するDiscordロールID
  - `RCLONE_REMOTE` — rcloneリモート名 (例: `gdrive:`)
  - `RCLONE_BASE_PATH` — Google Driveの保存先ベースパス (例: `企画鯖ワールドデータ`)
- [x] `PterodactylBackupService` にロック操作を追加
  - `toggleLock(serverId, backupUuid)` — `POST .../backups/{uuid}/toggle-lock`
- [x] `PterodactylService` にサーバー再インストール機能を追加
  - `reinstallServer(serverId)` — `POST .../servers/{id}/reinstall`

---

## Phase 2: 申請フロー

- [x] `WorkflowService` を作成 (`src/domain/services/WorkflowService.ts`)
  - `create(...)` — 申請の挿入
  - `findById(id)` — ID検索
  - `findByStatus(status)` — ステータス検索
  - `updateStatus(id, status, ...)` — ステータス・割り当て情報の更新
- [x] `/mcserver` コマンド実装 (`src/commands/mcserver.ts`)
  - `/mcserver checkout` — モーダルフォーム表示（5項目の入力）→ DB記録 → 申請受付通知
  - `/mcserver reset-password` — 実行者の Discord ID から `PterodactylUser` を検索し、パスワードリセット
- [x] `/mcserver-admin workflow edit` コマンド実装
  - PENDING の申請を編集。/mcserver checkout と同じ引数と同じ形式のモーダルを表示。なるべくクラスを再利用するように。

---

## Phase 3: 承認・割り当てフロー

- [x] `/mcserver-admin workflow list` コマンド実装
  - PENDING の申請一覧を Embed で表示
- [x] `/mcserver-admin workflow approve` コマンド実装（インタラクティブフロー）
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

- [x] `/mcserver-admin checkout list` コマンド実装
  - ACTIVE の貸出一覧を Embed で表示（サーバーID、主催者、期限、残り日数等）
- [x] `/mcserver-admin checkout extend` コマンド実装
  - `id` と日付を受け取り、ステータスに応じた動作：
    - PENDING: `periodDays` を上書き（承認前に期間を調整する場合に使用）
    - ACTIVE: `endDate` を指定日付に設定

---

## Phase 5: 返却フロー

- [x] rclone アップロード用ユーティリティを作成 (`src/domain/services/RcloneService.ts`)
  - ローカルファイルを `RCLONE_REMOTE` + `RCLONE_BASE_PATH` 配下に転送
- [x] `ArchiveService` を作成 (`src/domain/services/ArchiveService.ts`)
  - バックアップ選択サジェスト（最新バックアップ + ロック済みバックアップ）
  - バックアップダウンロード → rclone アップロード
  - 全ロック済みバックアップのロック解除
- [x] src/domain/flows/ReturnFlow.ts を作成
  - サーバー再インストール（初期化）
  - パネル権限付与対象ユーザーの権限剥奪（`WorkflowPanelUser` に記録されたユーザーを対象）
  - ステータスを `RETURNED` に更新
  - 主催者・パネル権限付与対象ユーザーへ返却通知
- [x] `/mcserver-admin checkout return` コマンド実装（インタラクティブフロー）
  1. 申請情報・バックアップ一覧を表示
  2. Select Menu でバックアップを選択
  3. モーダルで日付・補足コメントを入力
  4. `ArchiveService` を呼び出し返却処理実行

---

## Phase 6: 自動タスク

- [x] スケジューラー基盤を作成 (`src/services/Scheduler.ts` など)
  - Bot起動時に開始、定期実行（例: 1時間ごと）
- [x] リマインド通知タスク
  - 期限 3 日前・1 日前の ACTIVE 貸出を検出
  - 主催者に期限切れ予定の通知を送信
- [x] 自動返却タスク
  - 期限切れ（`endDate` が過去）の ACTIVE 貸出を検出
  - 管理者に返却処理の開始通知を送信 → バックアップ選択フローを開始

---

## 完了済み改善・機能追加

以下は基本実装後に追加された機能改善項目です。

### 通知・UI改善
- [x] DMじゃなくてチャンネルで通知
- [x] 見た目改善
  - [x] 「ロック済みバックアップと最新ファイル状態（一時バックアップ）をアーカイブし、ロック済みバックアップのロックを解除します。」パネルをバックアップされるリストにする
  - [x] 処理のプログレスを出す
  - [x] 「返却されました」Embedにする、ドライブリンク取得コマンドへのリンク
  - [x] 主催者とパネルサーバーとサーバーは横並び
  - [x] サーバー貸し出しが作成という日本語を修正
  - [x] 2回出るのを治す
  - [x] Embedにする
  - [x] ガントチャート貸し出し状況

### アーカイブ・バックアップ機能
- [x] アーカイブ済み企画とファイル一覧確認
- [x] バックアップ一時ファイルは消す
- [x] ptero backup でrclone試せるように
- [x] Google Driveのリンクを出す機能

### ワークフロー機能拡張
- [x] 返却日じゃなくて、企画主催日にする
  - [x] あらかじめワークフローに入れて置けるように
  - [x] 補足コメント削除、代わりに★にする
  - [x] サーバーの用途に日付不要
- [x] 強制じゃないreturn
- [x] 延期ボタン（利用者も押せる）
- [x] extendコマンドも日付パーサーを使う
- [x] workflow で状態(REJECTED, RETURNED, ACTIVE, ALL)を指定できるようにする
  - [x] ページネーション
- [x] 申請を無理やり追加する方法、サーバーを初期化することなく割り当てる
- [x] 却下ボタン
- [x] /mcserver return または返却ボタン
- [x] 返却時はReinstallしない。貸出時にserver.properties以外があった場合、エラー

### サーバー管理改善
- [x] サーバーIDはPterodactylのIDじゃなくてbinding名へ
- [x] version_history.jsonからバージョンを特定
- [x] Pterodactyl説明自動変更

### ユーザー管理改善
- [x] autocompletionでID入れたら企画名サジェスト
- [x] approvalFlowで「1. パネルユーザーに Discord ロール付与（未付与の場合のみ）」時にPterodactylユーザーがないときに登録できるように
  - [x] 「1. パネルユーザーに Discord ロール付与（未付与の場合のみ）」はuser register時に行う
- [x] ユーザーがうまく割当たってない不具合なおす
- [x] ユーザーが登録されていない場合、登録ダイアログだす
- [x] SQLにニックネームを用意して、～～主催をなんとかする

### フォーム・入力改善
- [x] 貸し出し希望期間のフォーム消す（1週間 or 企画日+2日）
- [x] 登録ダイアログから期限を消す
- [x] 最初からパネルを表示しておく

### コード改善
- [x] @/ パスにする
- [x] ModalHandler.buildなどにまとめる
- [x] /pteroコマンドをmcserver_adminへ移行する

### デプロイ関連
- [x] すべてのPterodactylユーザー登録
- [x] ロック付きバックアップ退避
  - [x] アイテム集めビンゴをミニゲーム化
- [x] すべてのサーバーを登録
- [x] デプロイ
  - [x] rclone整備
