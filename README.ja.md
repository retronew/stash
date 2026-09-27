# Stash

[English](./README.md) | [简体中文](./README.zh-CN.md) | **日本語**

**チャットの画像とメッセージをひとまとめに。** チャットプラットフォームのボット経由でメッセージを受け取り、画像やファイルを自分のストレージにダウンロードして保存する、セルフホスト型・シングルユーザーの受信箱です。Cloudflare Workers + D1 + R2 + Queues だけで動き、個人利用なら無料プランに収まります。まずは QQ に対応しています。プラットフォーム層は、Telegram なども追加できるように設計しています。

## 機能

- **QQ ボット**：QQ オープンプラットフォームでボットを作成し、AppID / AppSecret を設定画面に入力して、Stash が表示するコールバック URL を QQ の管理画面に設定します。Stash はコールバック URL の検証（op 13）に応答し、すべてのイベントの Ed25519 署名を検証します。個別チャット、グループのメッセージ（@ の有無を問わず）、チャンネルのメッセージを保存し、再送されたイベントは一度だけ保存します。ボットごとに画像を設定できます（未設定なら QQ ボットのアイコン）
- **確実なファイル保存**：Webhook ではメッセージを D1 に書き込み、添付ファイルをキューに入れるだけなので、QQ へすぐに応答できます。キューのコンシューマーは各ファイルをバッファせずに R2 へストリーミングするため、数十〜数百 MB のファイルも保存できます（長さが分かる場合は 1 回のストリーミング PUT、不明または 5 GB 超の場合は 10 MB 単位のマルチパートアップロード）。保存後はサイズを `Content-Length` と照合します
- **再試行**：ネットワークエラー、タイムアウト、途中で切れたダウンロード、408 / 429 / 5xx は、30 秒から 2 時間まで間隔を空けて 9 回再試行します（合計約 5 時間で、無料プランのキュー保持期間 24 時間に収まります）。リンク切れ（その他の 4xx）はすぐに失敗扱いになります。コンシューマーがクラッシュした場合はデッドレターキューが受け止め、10 分ごとの巡回がキューメッセージを失ったものや中断されたダウンロードを再度キューに入れます。失敗したファイルは、Web アプリから個別に、またはまとめて再試行できます
- **プラットフォーム非依存**：各チャットプラットフォームは API 側ではアダプター、Web 側ではプラットフォーム登録の 1 項目です。画面・保存・キューはメッセージの出どころを意識しません
- **Web アプリ**：画像サムネイル付きのメッセージ一覧、原寸表示（画像・動画・音声）とダウンロード、ボット別・「添付あり」「失敗」での絞り込み
- **タスク**：すべてのダウンロードを一覧表示。上部に概要（保存済み・使用容量・処理中・失敗）を表示し、状態・種類・ボットで絞り込めます。タスクごとに詳細（サイズ、試行回数、エラー、次回の再試行、元の URL、R2 キー）を確認して再試行できます
- **イベント**：すべてのコールバックを記録します（既定で 30 日間保存）。ヒット（メッセージとして保存、または再送）とミス（無視されたイベント、URL 検証、署名不正や不明なボットによる拒否、保存エラー）の両方で、生データも確認できます。QQ のイベント名は翻訳して表示し、新しいイベントは元の名前で表示します
- **ZIP ダウンロード**：メッセージ画面の絞り込み（期間と、複数選択できるプラットフォーム・ボット・チャットの種類・個別の会話）のまま、または「設定 → データ」からプラットフォーム全体をダウンロードできます。期間、ファイルの種類、フォルダー構成（ボットと月ごと、チャットごと、なし）を選べ、`messages.json` も含められます。未保存や失敗したファイルは `report.txt` に記載されます。ZIP はブラウザで作成します（Worker の CPU 制限では数 GB のチェックサムを計算できないため）。Chrome と Edge はサイズに関係なくディスクへ直接書き込み、その他のブラウザは 500 MB ごとに分割してダウンロードします。ファイルは 3 件ずつ並行して取得し、失敗時は再試行し、終了後に失敗分だけ取り直せます
- **認証情報のテスト**：各ボット（と編集フォーム）に「認証情報をテスト」ボタンがあり、プラットフォームに直接確認します。QQ では公式の AppAccessToken 取得 API を使い、失敗時は QQ のエラーメッセージをそのまま表示します
- **保存期間**：「設定 → データ」でイベント記録と失敗したダウンロード記録の保存期間（プリセット・任意の日数・無期限）を設定でき、件数と使用容量も表示します
- **API トークン**：`Authorization: Bearer <token>` でスクリプトから API を呼び出せます（メッセージやファイルのバックアップなど）
- **MCP**：Claude などの AI アシスタントが `/api/mcp`（Streamable HTTP、API トークンで認証）に接続し、メッセージの検索、保存した画像の閲覧、ボット一覧、失敗したダウンロードの確認と再試行を行えます
- **絞り込みとライブ更新**：一覧の絞り込みは PickIt と同じ形式です（単一選択、検索できる複数選択、外せる絞り込みチップ）。タスクとイベントは 5 秒ごとのライブ更新と手動更新に対応しています
- **ログイン**：[Better Auth](https://better-auth.com) による Google / GitHub ログイン。設定画面で編集できるメールアドレスの許可リストに制限されます（パスワードなし）
- **言語**：中国語・英語・日本語。**テーマ**：システム / ライト / ダーク

## 仕組み

```
QQ ──webhook──▶ Worker ──署名検証──▶ D1（メッセージ + 添付行、状態 "pending"）
                            │
                            └──キュー投入──▶ キュー "stash-media" ──▶ コンシューマー ──ストリーミング──▶ R2
                                                │ バックオフ付き再試行        │
                                                └──▶ DLQ（失敗として記録）    └──▶ D1 状態 "stored"
Cron（10 分ごと）：失われた・中断されたダウンロードを再度キューへ
```

| パス | 役割 |
| --- | --- |
| `apps/api/src/platforms/` | プラットフォームごとのアダプター（検証 + 解析）。現在は `qq/` |
| `apps/api/src/ingest.ts` | メッセージと添付行を保存し、キューに投入 |
| `apps/api/src/media/` | R2 へのダウンロード、再試行ポリシー、キューコンシューマー、巡回 |
| `apps/web` | React アプリ（同じ Worker から配信） |
| `packages/shared` | Web と API で共有する型と翻訳 |

## 技術スタック

- **API**：Cloudflare Workers 上の [Hono](https://hono.dev)、D1（SQLite）、R2、Queues、Cron Triggers
- **Web**：React 19、React Router、TanStack Query、Tailwind CSS 4、[Base UI](https://base-ui.com) コンポーネント（coss ui）
- **i18n**：[Paraglide](https://inlang.com/m/gerre34r/library-inlang-paraglideJs)
- pnpm workspaces によるモノレポ

## ローカル開発

必要なもの：Node.js 24+、pnpm 11+。

```bash
pnpm install
cp apps/api/.dev.vars.example apps/api/.dev.vars   # ローカル用シークレット（git 管理外）
pnpm db:migrate   # ローカルの D1 にマイグレーションを適用
pnpm dev          # Web は http://localhost:5173、API は :8787
```

`wrangler dev` は D1・R2・Queues をローカルでシミュレートします。`.dev.vars.example` では `DEV_AUTH_BYPASS=1` が設定されており、`BETTER_AUTH_URL` が localhost の間はログインを省略できます。QQ から localhost には届かないため、実際のメッセージを試すにはデプロイするか、トンネルで 8787 番ポートを公開してください（例：`cloudflared tunnel --url http://localhost:8787`）。

### 翻訳

UI テキストは `packages/shared/messages/{zh,en,ja}.json` にあります。編集後に `pnpm --filter @stash/shared i18n` を実行してください。

### テスト

```bash
pnpm typecheck
pnpm test
```

## Cloudflare へのデプロイ

```bash
cd apps/api
npx wrangler d1 create stash-db              # 表示された id を wrangler.jsonc に貼り付け
npx wrangler r2 bucket create stash-media
npx wrangler queues create stash-media
npx wrangler queues create stash-media-dlq
npx wrangler secret put BETTER_AUTH_SECRET   # 長いランダム文字列
npx wrangler secret put ALLOWED_EMAILS       # you@example.com
cd ../..
pnpm db:migrate:remote
pnpm deploy
```

`wrangler.jsonc` の `vars` にある `BETTER_AUTH_URL` を公開オリジンに設定してください（カスタムドメインを使う場合は `routes` のコメントを外します）。設定画面に表示されるコールバック URL はこのオリジンで始まります。QQ は 443 番ポートの HTTPS を必要としますが、Workers のドメインやカスタムドメインであれば条件を満たします。

### ログイン（Google / GitHub）

コールバック URL を `https://<あなたのドメイン>/api/auth/callback/google`（または `/github`）にして OAuth アプリを作成し、`wrangler secret put` で `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` と `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` のどちらか一方、または両方を設定します。

### QQ ボットの接続

1. [q.qq.com](https://q.qq.com) でボットを作成し、**AppID** と **AppSecret** をコピーします。
2. Stash の「設定 → ボット → ボットを追加」に貼り付け、表示されたコールバック URL をコピーします。
3. QQ の管理画面の「開発 → コールバック設定」にコールバック URL を貼り付け（QQ がすぐに検証します）、`C2C_MESSAGE_CREATE`（個別チャット）や `GROUP_AT_MESSAGE_CREATE` などのメッセージイベントを購読します。
4. ボットを友だちに追加し、画像を送ってみましょう。ボットがサンドボックス段階の間は、先に自分をテストメンバーに追加してください。

### 無料プランの上限

Workers は 1 日 10 万リクエスト、D1 は 1 日 10 万行の書き込みと 5 GB、R2 は 10 GB のストレージ（超過分は約 $0.015/GB・月）、Queues は 1 日 1 万オペレーション（ファイル 1 件あたり約 3 回）。多くの場合、最初に上限に達するのはストレージです。

### 継続的デプロイ

`.github/workflows/ci.yml` はプッシュのたびに型チェック・テスト・ビルドを実行します。`main` へのプッシュでは、D1 マイグレーションの適用とデプロイも行います。リポジトリのシークレットに `CLOUDFLARE_API_TOKEN` と `CLOUDFLARE_ACCOUNT_ID` を追加してください。
