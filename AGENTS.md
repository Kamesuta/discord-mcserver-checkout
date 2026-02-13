## コーディング規約

### TypeScript / Discord.js

- **プライベート変数・メソッドには `_` プレフィックスをつける**
  - 例: `_BOARD_TITLE`, `_buildBoardContent()`, `_findOrCleanBoardMessages()`
  - このプロジェクトではprivate変数・メソッドに`_`をつける慣習

- **.send()で送るチャンネルの判定には `isSendable()` を使用**
  - 基本的に `channel?.isTextBased()` ではなく `channel?.isSendable()` を使う (TextChannelである必要がある場合はこの限りではない)
  - `isSendable()` チェック後は `channel as TextChannel` のキャストは不要
  - Discord.jsの型システムが自動的に絞り込むため

- **ないものは `null` ではなく `undefined` を使用**
  - 値が存在しない場合は `undefined` を返す
  - `null` は明示的に「値が存在しないことを示す」場合にのみ使用
  - TypeScriptの慣習に従い、オプショナルな値は `undefined` で表現

- **ボタンやモーダルの作成は、ハンドラークラスに `static build()` メソッドを用意**
  - インタラクションハンドラークラス内に `static build()` メソッドを定義
  - ボタン、モーダル、セレクトメニューなどのコンポーネント作成ロジックをカプセル化
  - customIdの生成ロジックもbuild()内で管理し、**ハンドラークラス外で生成しない**

- **権限は「一般向け(mcserver)」と「管理者向け(mcserver-op)」、「特殊操作向け(mcserver-admin)」の3つを用意**
  - コマンドは下記サブコマンドに分ける
    - mcserver: 一般ユーザー向けコマンド
    - mcserver-op: 管理者向けコマンド
    - mcserver-admin: 管理者向けイレギュラー対応コマンド
  - インタラクション系も同様に分ける
    - インタラクションは以下のようにして、**同様のコマンドの権限があるかどうか**で判定する
      ```typescript
      // /mcserver が使える人は全サーバーの返却ボタンを押せる
      const isGeneral =
        interaction.inCachedGuild() &&
        (await commandMentions.mcserver.checkPermission(interaction.member));

      // /mcserver-op が使える人は全サーバーの返却ボタンを押せる
      const isOp =
        interaction.inCachedGuild() &&
        (await commandMentions.mcserverOp.checkPermission(interaction.member));
      ```
