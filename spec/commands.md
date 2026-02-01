# コマンド一覧

## 既存コマンド（変更なし）

| コマンド | 説明 |
|---|---|
| `/mcserver_admin server_binding list` | サーバーバインディング一覧表示 |
| `/mcserver_admin server_binding set` | サーバーバインディング設定 |
| `/mcserver_admin server_binding unset` | サーバーバインディング削除 |
| `/mcserver_admin status` | サーバーステータス取得（エイリアス対応） |
| `/ptero status` | サーバーステータス取得（サーバーID直指定） |
| `/ptero start` | サーバー起動 |
| `/ptero stop` | サーバー停止 |
| `/ptero restart` | サーバー再起動 |
| `/ptero kill` | サーバー強制終了 |
| `/ptero user add` | サーバーにユーザー追加 |
| `/ptero user remove` | サーバーからユーザー削除 |
| `/ptero user register` | Pterodactylユーザー登録 |
| `/ptero user reset_password` | ユーザーパスワードリセット |
| `/ptero backup` | バックアップ作成・ダウンロード |

---

## 新規コマンド

### `/mcserver checkout` — サーバー貸出申請

| 項目 | 内容 |
|---|---|
| 対象ユーザー | 全ユーザー |
| パラメータ | なし（モーダルで入力） |
| 説明 | サーバー貸出申請フォームを開く |

**フロー**

1. ユーザーがコマンドを実行
2. モーダルが表示される（5項目を入力）
   - サーバーの説明/用途（企画名）
   - 希望MCバージョン
   - 貸出希望期間（日数）
   - 主催者の Discord ユーザーID
   - パネル権限付与対象ユーザーの Discord ユーザーID（カンマ区切りで複数可）
3. モーダル送信 → DBに申請を記録（ステータス: `PENDING`）
4. 申請受付通知を送信

---

### `/mcserver reset_password` — パスワードリセット

| 項目 | 内容 |
|---|---|
| 対象ユーザー | 全ユーザー |
| パラメータ | なし |
| 説明 | 実行者自身の Pterodactyl パスワードをリセットする |

実行者の Discord ユーザーID から `PterodactylUser` を検索し、パスワードを再生成して ephemeral で返す。登録済みでない場合はエラー。

---

### `/mcserver_admin workflow list` — 申請一覧表示

| 項目 | 内容 |
|---|---|
| 対象ユーザー | 管理者のみ |
| パラメータ | なし |
| 説明 | 承認待ち（`PENDING`）の申請一覧を表示 |

---

### `/mcserver_admin workflow approve` — 申請承認

| 項目 | 内容 |
|---|---|
| 対象ユーザー | 管理者のみ |
| パラメータ | `id: Integer` — ワークフロー ID |
| 説明 | 申請を承認し、ユーザー作成・サーバー割り当てを実行する |

**フロー**

1. 申請内容を Embed で表示
2. パネル権限付与対象ユーザーの Pterodactyl 登録済みかDBで確認
3. **未登録ユーザーがある場合**: モーダルが表示され、各ユーザーのユーザー名を入力
   - `registerUser(username)` で Pterodactyl アカウント作成
   - `PterodactylUser` テーブルに Discord ID ↔ ユーザー名 の対応を保存
4. パネル権限付与対象ユーザーに専用 Discord ロールを付与（`DISCORD_PANEL_USER_ROLE_ID`、未付与の場合のみ）
5. `ServerBinding` に登録されて未割り当て（いずれの ACTIVE Workflow にも割り当てられていない）のサーバーを検索して割り当て
6. パネルにユーザー追加・権限付与（`addUser`）
7. `Workflow.status` を `ACTIVE` に更新（`pteroServerId`, `startDate`, `endDate` を記録）
8. **パネル権限付与対象ユーザー**へ接続情報を通知
9. **主催者**へ割り当てサーバー情報を通知

---

### `/mcserver_admin checkout list` — 貸出一覧表示

| 項目 | 内容 |
|---|---|
| 対象ユーザー | 管理者のみ |
| パラメータ | なし |
| 説明 | 貸出中（`ACTIVE`）の一覧を表示 |

表示項目: ワークフロー ID、企画名、主催者、サーバーID、開始日、終了日、残り日数

---

### `/mcserver_admin checkout extend` — 期限変更

| 項目 | 内容 |
|---|---|
| 対象ユーザー | 管理者のみ |
| パラメータ | `id: Integer` — ワークフロー ID、`date: String` — 日付 (YYYY-MM-DD) |
| 説明 | 貸出期限を変更する。ステータスに応じた動作を行う |

**ステータスごとの動作**

| ステータス | 動作 | ユースケース |
|---|---|---|
| `PENDING` | `periodDays` を `(指定日付 - 今日)` の日数に上書き | 申請された期間が長過ぎるため、承認前に短縮する |
| `ACTIVE` | `endDate` を指定日付に設定 | 貸出期限の延長・短縮 |
| `RETURNED` | エラー | 変更不可 |

---

### `/mcserver_admin checkout return` — 強制返却

| 項目 | 内容 |
|---|---|
| 対象ユーザー | 管理者のみ |
| パラメータ | `id: Integer` — ワークフロー ID |
| 説明 | 強制返却を実行する（バックアップ選択フロー含む） |

**フロー**

1. 申請情報を表示し、Pterodactylからバックアップ一覧を取得
2. **サジェスト対象**: 最新バックアップ + ロック済みバックアップを Select Menu で表示
3. 管理者がバックアップを選択
4. モーダルが表示される（2項目を入力）
   - 日付（`YYYYMMdd`形式、バックアップ保存先フォルダ名に使用）
   - 補足コメント（任意、ファイル名に使用）
5. バックアップをダウンロード → rclone で Google Drive に保存

   保存先パス:
   ```
   {RCLONE_BASE_PATH}/{YYYY}/{ID}_{YYYYMMdd}_{企画名}_{主催者名}主催/{バックアップの日付}_{補足}.tar.gz
   ```
   - `YYYY`: バックアップの作成年
   - `ID`: ワークフロー ID
   - `YYYYMMdd`: 管理者が入力した日付
   - `企画名`: `Workflow.description`
   - `主催者名`: 主催者の Discord displayName
   - `バックアップの日付`: 選択したバックアップの `created_at`
   - `補足`: 管理者入力（あれば）

6. そのサーバーの全ロック済みバックアップのロックを解除
7. サーバーを再インストール（初期化）
8. `WorkflowPanelUser` に記録されたパネル権限付与対象ユーザーの権限を剥奪
9. `Workflow.status` を `RETURNED` に更新
10. **主催者・パネル権限付与対象ユーザー**へ返却通知を送信

---

## 自動タスク（コマンドではなくスケジューラー）

| タスク名 | 実行頻度 | 説明 |
|---|---|---|
| リマインド通知 | 定期（例: 1時間ごと） | 期限 3 日前・1 日前の ACTIVE 貸出を検出し、主催者に通知 |
| 自動返却 | 定期（例: 1時間ごと） | 期限切れの ACTIVE 貸出を検出し、管理者に通知を送信してバックアップ選択フローを開始 |
