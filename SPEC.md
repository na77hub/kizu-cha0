# kizu-cha0 仕様書

コードを読み取って整理したもの。1〜10章は実装済みの挙動（リファクタリング後）、11章はチャット機能の仕様（**未実装**）。

## 1. 概要

kizu-cha0 は、Web Push を使って「ルーム」に参加している端末へ通知を送る Web アプリ。

- 参加者はルームの URL（`/kc/<roomId>/`）を開き、「購読」ボタンで Web Push を有効にする。
- 誰かが「送信」ボタンを押すと、同じルームの購読端末すべてに通知が届く。
- ブラウザを閉じていても、Service Worker が通知を表示する。
- ログイン機能はなく、ルーム名を知っていれば誰でも参加・送信できる。

## 2. 技術構成

| 区分 | 使用技術 |
|---|---|
| サーバ | Node.js (ESM) / Express 5 / Socket.IO 4 / web-push / @seald-io/nedb（Promise API） |
| クライアント | 標準 DOM API / socket.io-client / Service Worker / Push API |
| ビルド | Vite（`src/` → `public/`）、vite-plugin-static-copy |
| 品質 | ESLint / Prettier / `node:test` |
| その他 | compression, serve-favicon, qrcode, dotenv |

| コマンド | 内容 |
|---|---|
| `npm run build-client` | クライアントを `public/` へビルド |
| `npm start` | サーバを起動（`node server/index.js`） |
| `npm run dev` | Vite の開発サーバ |
| `npm test` | テスト（`node --test`） |
| `npm run lint` / `npm run format` | ESLint / Prettier |

## 3. ディレクトリ構成

| パス | 内容 |
|---|---|
| `server/index.js` | 起動処理（各モジュールの組み立て、HTTP/HTTPS サーバ、QR コード生成） |
| `server/config.js` | 設定（ポート、パス、ディレクトリ、VAPID 鍵）。環境変数で上書き可 |
| `server/routes.js` | Express のルーティング、Web App Manifest 生成 |
| `server/socket.js` | Socket.IO の接続検証とイベント処理 |
| `server/push.js` | Web Push 送信（失効した購読の削除を含む） |
| `server/recipients.js` | 通知の宛先を決める関数（`resolveRecipients`） |
| `server/subscriptions.js` | 購読ストア（nedb） |
| `server/validators.js` | 入力検証（`isValidRoomId` など） |
| `server/network.js` | ローカル IP アドレスの取得 |
| `src/` | クライアントのソース（`index.html`, `main.js`, `push.js`, `socket.js`, `room.js`, `client-id.js`, `service-worker.js`） |
| `test/` | テスト |
| `public/` | Vite のビルド出力（git 管理外）。`/kc/:roomId/` で配信 |
| `root/` | サイトルート `/` で配信する静的ファイル（ルーム一覧ページ、起動時生成の QR コード `2Dcode.png`） |
| `image/` | ファビコン・アイコン（`/image/` で配信） |
| `ssl_cert/` | HTTPS 用の証明書・鍵 |
| `database/` | nedb のデータ（`subscriptions.db`、自動作成、git 管理外） |

## 4. 設定

### 4.1 `server/config.js`

| 項目 | 既定値 | 意味 |
|---|---|---|
| `protocol` | `"http"`（環境変数 `PROTOCOL`） | `"https"` で HTTPS 起動。このときだけ SSL ファイルを読む |
| `port` | `50091`（環境変数 `PORT`） | サーバのポート |
| `siteBasePath` | `/` | 静的サイトのルートパス |
| `roomBasePath` | `/kc/` | ルームのルートパス |

### 4.2 環境変数（`.env`）

| 変数 | 用途 |
|---|---|
| `VAPID_SUBJECT` | VAPID の連絡先（`mailto:` または `https://`） |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | サーバ側 VAPID 鍵 |
| `VITE_VAPID_PUBLIC_KEY` | クライアントに埋め込む公開鍵（ビルド時に反映） |
| `PROTOCOL` / `PORT` | 任意。プロトコルとポートの上書き |
| `http_proxy` | 設定されていれば Web Push 送信時にプロキシ経由 |

## 5. HTTP ルーティング（`server/routes.js`）

| パス | 動作 |
|---|---|
| `GET /` ほか | `root/` の静的ファイル（ルーム一覧ページ） |
| `GET /image/*` | `image/` の静的ファイル |
| `GET /kc/:roomId` | `public/index.html` を返す（ルーム画面） |
| `GET /kc/:roomId/manifest.webmanifest` | ルーム名入りの Web App Manifest を動的生成（standalone 表示、192px アイコン） |
| `GET /kc/:roomId/*` | `public/` 配下の静的ファイル（JS、`service-worker.js` など）。無ければ 404 |

- ルーム名の検証（`/kc/:roomId` 全体）: 空文字、および `\ / : * ? " < > | .` を含む場合は 400。
- 起動時に最初の IPv4 アドレスの URL を QR コード化し、`root/2Dcode.png` に保存する。

## 6. クライアント仕様

### 6.1 画面（`src/index.html`）

- タイトル「kizu-cha ZERO」
- `Room:<roomId>` 表示（URL の `/kc/` の次のセグメントから取得）
- `Web Push:true/false` 表示（購読状態）
- ボタン: 「購読」「購読解除」「送信」

### 6.2 動作

1. 読み込み時に `roomId` を取得し、`clientId` を決める。`clientId` は `localStorage`（キー `kizu-cha-client-id`）に保存した端末ごとの UUID。Socket.IO に `query: {roomId, clientId}` つきで接続し、購読状態を表示する。
2. **購読**（`push.js` の `enablePush`）: Service Worker（`./service-worker.js`）を登録して `ready` を待つ → 既存購読がなければ `VITE_VAPID_PUBLIC_KEY` で `pushManager.subscribe`（`userVisibleOnly: true`）→ `push:subscribe` をサーバへ送る。
3. **購読解除**（`disablePush`）: ブラウザ側で `unsubscribe()` し、成功したら `push:unsubscribe` をサーバへ送る。Service Worker 自体の登録は残す。
4. **送信**: `push:send` を `{body: "こんにちは、kizu-cha ZEROです！"}` で送る（固定文字列。チャット機能で置き換え予定）。
5. ボタン操作のたびに購読状態表示を更新する。
6. サーバへのイベントは確認応答（ack）つきで送り、`{ok: false}` のときは警告をログに出す。

### 6.3 Service Worker（`src/service-worker.js`）

`push` イベントでペイロード（JSON `{title, body, url}`。JSON でない・空でも可）を読み、通知を表示する。アイコンとバッジは `/image/favicon-128x128.png`。通知クリックで `url` のページを開く（開いていれば前面に出す）。

## 7. Socket.IO イベント仕様

イベント名は `領域:動作` の形。クライアントからのイベントには確認応答（ack）で結果を返す。成功は `{ok: true, ...}`、失敗は `{ok: false, error: "<コード>"}`。

### 7.1 接続

クライアントは `query` で `roomId` と `clientId` を渡す。サーバは `roomId` が形式エラー、または `clientId` が UUID 形式でない接続を `invalid_query` で拒否する（クライアントには `connect_error`）。通過した接続は `roomId` のルームに join し、`session:ready` を emit する。以降の処理は、クライアントが申告した値ではなく接続時の `roomId` / `clientId` を使う。

### 7.2 イベント

| 方向 | イベント | データ | サーバの処理・応答 |
|---|---|---|---|
| C→S | `push:subscribe` | `{subscription}` | `endpoint` / `keys.p256dh` / `keys.auth` を検証し、購読を保存（同じ roomId + endpoint は上書き）。エラー: `invalid_subscription` |
| C→S | `push:unsubscribe` | `{endpoint}` | 同じ roomId + endpoint の購読を削除。エラー: `invalid_endpoint` |
| C→S | `push:send` | `{body}` | 1〜200文字を検証し、そのルームの全購読へ `{title, body, url}` を送信。応答は `{ok, sent, failed}`。エラー: `invalid_body`（チャットの `chat:post` で置き換え予定） |
| S→C | `session:ready` | なし | 接続完了の通知 |

想定外の例外は `internal_error` を返し、サーバは落とさない。送信時に HTTP 404 / 410 が返った購読は DB から削除する。

## 8. データモデル

nedb（`database/subscriptions.db`）の 1 ドキュメント = 1 端末 × 1 ルームの購読。

```json
{
  "_id": "roomId と endpoint から作る固定 ID（SHA-256 の先頭32文字）",
  "roomId": "tmp",
  "clientId": "123e4567-e89b-12d3-a456-426614174000",
  "subscription": {
    "endpoint": "https://...",
    "expirationTime": null,
    "keys": { "p256dh": "...", "auth": "..." }
  }
}
```

`_id` を固定にすることで、同時に登録しても二重にならない（upsert）。

## 9. 通知フロー

```
[端末A] 購読 ──push:subscribe──▶ [サーバ] ──upsert──▶ DB
[端末B] 送信 ──push:send──▶ [サーバ] ──findByRoom(roomId)──▶ DB
                               └─ resolveRecipients ─ web-push ─▶ プッシュサービス ─▶ [端末A,B…] Service Worker ─▶ 通知表示
```

## 10. 既知の問題・未実装

1. **認証・認可なし**: ルーム名を知っていれば誰でも購読・送信できる。方針は 11.8 のとおり（当面は認証なし）。`clientId` は自己申告で、なりすませる。
2. **通知本文が固定**: 送信ボタンのメッセージは固定文字列。入力 UI や送信者情報はない（チャット機能で解消予定）。
3. **スコープ**: Service Worker は `/kc/<roomId>/` スコープで登録され、manifest もルーム単位。同一端末で複数ルームを使うと、ルームごとに別の購読（endpoint）ができる。
4. **HTTPS**: 既定は `http`（localhost 用）。Web Push はスマホ等の実機では HTTPS が必要。`ssl_cert/server.key` が git に含まれている。
5. **`root/index.html`** のルーム一覧は `tmp` のみ固定。ルームの作成・一覧機能はない。
6. **旧データ**: 旧版の `database/subscriptionDB.db` と、旧名の Service Worker（`sw_kizu-cha.js`）の登録は引き継がない。端末側で再購読が必要。

## 11. チャット機能の仕様（未実装）

### 11.1 目的と範囲

- 同じルームの利用者どうしでテキストチャットをする。
- 投稿されると、そのルームで Web Push を購読している全員に通知する（投稿者自身の端末を除く）。
- 今回のフェーズに含めない拡張: 通知先の指定、キーワードによる受信フィルタ。これらを後から追加できる構造にしておく。

### 11.2 方針

1. 「投稿」と「配信」を分ける。投稿はメッセージとして保存し、配信は宛先決定の関数を通す。
2. 宛先・キーワード用の項目を、今回は使わないが予約しておく。
3. 購読を端末の識別子（clientId）と結びつける。
4. 既存の「送信」ボタン（固定文言）と `push:send` イベントは、チャット投稿に置き換えて廃止する。

### 11.3 データモデル

メッセージ（新規ストア `server/messages.js`、`database/messages.db`）:

| 項目 | 型 | 内容 |
|---|---|---|
| `_id` | string | nedb が付与 |
| `roomId` | string | ルーム名 |
| `clientId` | string | 投稿者の端末識別子 |
| `name` | string | 投稿時の表示名 |
| `body` | string | 本文（1〜500文字） |
| `createdAt` | number | サーバ時刻（ミリ秒）。並び順の基準 |
| `to` | null | 予約。`null` は全員宛て。将来は clientId の配列 |

購読（既存の購読ストアを拡張。`clientId` は実装済み）:

| 項目 | 内容 |
|---|---|
| `clientId` | 購読した端末の識別子。投稿者の端末を通知から除く判定に使う |
| `keywords` | 追加（予約）。空配列は全件受信。今回は常に空 |

保存期間: ルームごとに最新1000件。超えた分は古いものから削除する。

### 11.4 Socket.IO イベント

| 方向 | イベント | データ | 処理 |
|---|---|---|---|
| C→S | `chat:post` | `{body}` | 検証 → 保存 → ルーム内へ `chat:message` を配信 → Web Push 配信 |
| S→C | `chat:message` | メッセージ1件 | 画面の末尾に追加 |
| S→C | `chat:history` | メッセージ配列（新しい順に最大50件） | 接続直後に本人だけへ送る。画面では古い順に並べる |
| C→S | `profile:update` | `{name}` | 表示名の変更。接続の `query` でも初期値を渡せる |

検証エラー（`invalid_body`）や連投制限（`rate_limited`）は、別イベントではなく `chat:post` の確認応答 `{ok: false, error}` で返す。

ルームと投稿者は接続時の `roomId` / `clientId` を使い、クライアントからは受け取らない。

### 11.5 通知の配信

宛先は `resolveRecipients(message, subscriptions)` の1か所で決める。

1. ルームが同じ購読を取り出す。
2. 投稿者自身の端末（`clientId` が同じ購読）を除外する。
3. （将来）`message.to` があれば、その clientId に絞る。
4. （将来）購読の `keywords` があれば、本文に含まれる場合だけ残す。

通知ペイロード（JSON、4KB 以下）:

```json
{ "title": "<ルーム名> / <表示名>", "body": "<本文の先頭100文字>", "url": "/kc/<roomId>/", "tag": "<roomId>", "messageId": "..." }
```

- 通知の `tag` はルーム名にし、同じルームの通知は置き換わる。
- ページが前面で開いているときは通知を出さない（Socket.IO で表示済みのため）。Service Worker で `clients.matchAll` の `visibilityState` を見て判定する。

### 11.6 画面

- 表示名の入力欄（`localStorage` に保存。初期値は「ゲスト」+ clientId 先頭4文字）。重複は認め、clientId 由来の色や短い ID で見分ける。
- メッセージ一覧（表示名、時刻、本文。自分の投稿は見分けられるようにする）。
- 本文の入力欄と送信ボタン（Enter で送信。IME の変換確定中は送信しない）。
- 既存の「購読」「購読解除」と購読状態の表示は残す。
- 本文と表示名は `.text()` で描画し、HTML として解釈しない（XSS 対策）。

### 11.7 制限と検証

- 本文は文字列で1〜500文字、表示名は1〜20文字。範囲外は破棄し、確認応答 を返す。
- 連投制限: 1接続につき10秒に5件まで。超えた分は破棄する。

### 11.8 認証

- 認証は設けない。ルーム名を知っていれば誰でも参加でき、履歴も読める。
- ルーム名の形式は現状のまま（短い名前も可）。推測されたくない場合は、利用者が長い名前を付ける運用とし、コードでは強制しない。
- 将来パスコードが必要になれば、接続時の `roomId` 確認に追加する。

### 11.9 受け入れ条件

1. 同じルームの2端末で、一方の投稿がもう一方に即時表示される。
2. 別のルームには届かない。
3. 購読中の他端末に通知が届き、投稿者自身の端末には届かない。
4. ページを閉じていても通知が届き、クリックでルームが開く。
5. 後から入室した人に、直近50件が表示される。
6. 不正な入力（空文字、501文字以上、連投）でサーバが落ちない。
7. 失効した購読（404/410）は DB から削除される。
8. ルームごとの履歴が1000件を超えたら、古いものから削除される。
