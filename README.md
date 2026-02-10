# Minecraftサーバー管理BOT

Minecraftサーバーの貸出申請から承認、返却、アーカイブまでの運用プロセスを自動化・半自動化するDiscord BOTです。

## 📋 概要

このBOTは、Minecraftサーバーの貸出管理を行い、運営負荷を大幅に削減します。Discord上で申請を受け付け、Pterodactylパネルと連携してサーバーの割り当て、ユーザー権限管理、バックアップ、返却処理を自動化します。

詳細な要件は [spec/要件定義書.md](spec/要件定義書.md) を参照してください。

## ✨ 主要機能

### 📝 貸出申請機能
Discordのフォーム機能を使用してサーバー貸出申請を受け付けます。

- 企画名、Minecraftバージョン、貸出期間、主催者、パネルユーザー、開催日を入力
- 申請情報をデータベースに自動記録
- 申請受付の自動通知
- 通知ボードに申請を自動反映

### 👤 管理者承認機能
管理者が申請を承認し、Pterodactylユーザーを作成します。

- 申請一覧の表示（ステータスフィルタ、ページネーション対応）
- 未登録ユーザーの自動検出とユーザー登録モーダル表示
- メールアドレス自動生成（`[username]@kpw.local`形式）
- Discord IDとPterodactylユーザーの関連付けをDB保存
- パネルユーザーに専用Discordロールを自動付与

### 🖥️ 自動サーバー割り当て機能
承認後、利用可能なサーバーを自動で割り当てます。

- 利用可能なサーバーを自動検索
- パネルユーザーをPterodactylパネルに自動追加
- サーバー権限を自動付与
- サーバーDescription自動更新（`[主催者名] [企画名]`）
- Minecraftバージョン自動判定（version_history.json優先）
- 接続情報を申請者・主催者・パネルユーザーに自動通知

### 📊 貸出情報管理機能
現在の貸出状況を管理・表示します。

- 貸出中サーバー一覧をガントチャート表示
- 通知ボードでACTIVE申請を一覧表示
- サーバーステータス確認（CPU、メモリ、ディスク使用量）
- プログレストラッカーで長時間処理の進捗を可視化

### ⏰ 期限管理・リマインド機能
貸出期限の管理とユーザーへの事前通知を行います。

- 毎日18時に自動スケジュール実行
- 期限3日前・1日前に主催者へ自動リマインド通知
- 通知から1クリックで延長可能なボタン付き
- 期限延長申請の受付（主催者・管理者）

### 🔧 管理者向けサーバー管理機能
管理者による柔軟なサーバー管理を可能にします。

- 貸出期限の変更（日付パーサー対応）
- 即時強制返却の実行
- サーバー電源操作（start/stop/restart/kill）
- サーバーリセット・クリーンアップ（全ファイル削除）
- バックアップ作成・ダウンロード
- サーバーバインディング管理（サーバー名 ↔ Pterodactyl ID）

### 🔄 自動返却フロー機能
期限切れサーバーを検出してリマインドし、ワンクリックで返却処理を実行します。

- 毎日18時に期限切れサーバーを自動検出
- 管理者へリマインド通知
- 通知から延長または返却を選択可能

### 📦 返却処理機能
自動返却及び手動返却実行時に呼ばれる共通の返却処理です。

- サーバー自動停止
- ロック済みバックアップ + 最新状態（一時バックアップ）を両方アーカイブ
- Google Driveへrcloneで自動アップロード
- バックアップ命名規則：`企画鯖ワールドデータ/YYYY/YYYY-MM-DD_ID[ID]_[企画名]_[主催者名]主催[_MCバージョン]/`
- ロック済みバックアップの自動ロック解除
- サーバーリセット（全ファイル削除）
- パネルユーザーの権限自動剥奪（管理者除外）
- 主催者・パネルユーザーへ返却通知
- アーカイブ・リセットのスキップオプション対応

## 🎯 コマンド一覧

詳細なコマンド仕様は [spec/コマンド.md](spec/コマンド.md) を参照してください。

### 一般ユーザー向けコマンド (`/mcserver`)
- `checkout` - サーバー貸出申請
- `return` - 自分のサーバーを返却
- `extend` - 貸出期限を1週間延長
- `reset-password` - Pterodactylパスワードをリセット

### 管理者向けコマンド (`/mcserver-op`)
- `workflow` - 申請管理（list/edit/approve）
- `checkout` - 貸出管理（create/list/return/extend/server-status）
- `archive` - アーカイブ管理（list/get）
- `user` - ユーザー管理（register）

### 管理者向けイレギュラー対応 (`/mcserver-admin`)
- `server-binding` - サーバーバインディング管理（list/set/unset）
- `server` - サーバー管理（status/power/backup/clean/description）

## 🏗️ 技術スタック

- **Node.js** 22.x
- **TypeScript** - 型安全な開発
- **Discord.js** v14 - Discord BOT開発
- **Sapphire Framework** - コマンドフレームワーク
- **Prisma** - ORM（MySQL/MariaDB）
- **Pterodactyl API** - サーバーパネル操作
- **rclone** - Google Driveバックアップ
- **node-schedule** - 定期タスク実行

## 🚀 セットアップ

### 前提条件
- Node.js 22.x
- MySQL/MariaDB
- Pterodactylパネル
- rclone（Google Drive連携用）

### インストール

```bash
# 依存関係のインストール
npm install

# データベースマイグレーション
npx prisma migrate deploy

# Prismaクライアント生成
npx prisma generate

# ビルド
npm run build

# 起動
npm start
```

### 環境変数

Discord、Database、Pterodactyl、rcloneの各種認証情報を設定してください。詳細は `.env.example` を参照してください。

## 🔧 開発

### コーディング規約

詳細は [AGENTS.md](AGENTS.md) を参照してください。

### 開発コマンド

```bash
# 開発モード起動
npm run dev

# ビルド
npm run build

# Prismaスタジオ起動
npx prisma studio
```
