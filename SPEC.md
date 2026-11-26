# kizu-cha0 仕様書

コードを読み取って整理したもの。全章が実装済みの仕様。チャット機能の詳細は11章、実装時の補足は11.12 にまとめた。

## 1. 概要

kizu-cha0 は、Web Push を使って「ルーム」に参加している端末へ通知を送る Web アプリ。

- 参加者はルームの URL（`/kc/<roomId>/`）を開き、「購読」ボタンで Web Push を有効にする。
- ルーム内でチャットができ、投稿すると同じルームの購読端末（投稿者自身の端末を除く）に通知が届く。通知は、すべての投稿か、登録したキーワードを含む投稿だけかを選べる（12章）。
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
| `server/messages.js` | チャットのメッセージストア（nedb、ルームごとに最新1000件） |
| `server/message-format.js` | メッセージの公開形式・通知ペイロードの生成 |
| `server/sender-id.js` | `clientId` から公開用 `senderId` を作る |
| `server/preferences.js` | 通知設定の検証と保存（nedb） |
| `server/keyword-matcher.js` | キーワードの正規化と一致判定 |
| `server/rate-limiter.js` | 連投制限 |
| `server/handlers/` | Socket.IO のイベントハンドラ（`push.js`、`chat.js`、`preferences.js`） |
| `server/validators.js` | 入力検証（`isValidRoomId` など） |
| `server/proxy.js` | プロキシの使用状況の表示 |
| `server/network.js` | ローカル IP アドレスの取得 |
| `src/` | クライアントのソース（`index.html`, `main.js`, `push.js`, `socket.js`, `room.js`, `client-id.js`, `chat.js`, `preferences.js`, `service-worker.js`） |
| `test/` | テスト |
| `public/` | Vite のビルド出力（git 管理外）。`/kc/:roomId/` で配信 |
| `root/` | サイトルート `/` で配信する静的ファイル（ルーム一覧ページ、起動時生成の QR コード `2Dcode.png`） |
| `image/` | ファビコン・アイコン（`/image/` で配信） |
| `ssl_cert/` | HTTPS 用の証明書・鍵 |
| `database/` | nedb のデータ（`subscriptions.db`、`messages.db`、`preferences.db`。自動作成、git 管理外） |

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
| `http_proxy` | 設定されていれば Web Push 送信時にプロキシ経由（小文字のみ。`HTTP_PROXY` / `https_proxy` / `HTTPS_PROXY` は使わない）。起動時のログに使用の有無を表示し（認証情報は伏せる）、送信結果のログには `WebPush(proxy)` / `WebPush(direct)` を付ける |

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
- ボタン: 「購読」「購読解除」
- チャット欄（メッセージ一覧、表示名・本文の入力欄、送信ボタン。11.6）

### 6.2 動作

1. 読み込み時に `roomId` を取得し、`clientId` を決める。`clientId` は `localStorage`（キー `kizu-cha-client-id`）に保存した端末ごとの UUID。Socket.IO に `query: {roomId, clientId}` つきで接続し、購読状態を表示する。
2. **購読**（`push.js` の `enablePush`）: Service Worker（`./service-worker.js`）を登録して `ready` を待つ → 既存購読がなければ `VITE_VAPID_PUBLIC_KEY` で `pushManager.subscribe`（`userVisibleOnly: true`）→ `push:subscribe` をサーバへ送る。
3. **購読解除**（`disablePush`）: ブラウザ側で `unsubscribe()` し、成功したら `push:unsubscribe` をサーバへ送る。Service Worker 自体の登録は残す。
4. **チャット**: `chat:post` で投稿し、`chat:message` / `chat:history` で受信する。通知の受け方は `preferences:update` で保存する（12章）。
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
| S→C | `session:ready` | `{senderId}` | 接続完了の通知 |

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
[端末B] 投稿 ──chat:post──▶ [サーバ] ──保存──▶ DB、──findByRoom(roomId)──▶ DB
                               └─ resolveRecipients（通知設定で絞り込み） ─ web-push ─▶ プッシュサービス ─▶ [端末A,B…] Service Worker ─▶ 通知表示
```

## 10. 既知の問題・未実装

1. **認証・認可なし**: ルーム名を知っていれば誰でも購読・送信できる。方針は 11.8 のとおり（当面は認証なし）。`clientId` は自己申告で、なりすませる。
2. **スコープ**: Service Worker は `/kc/<roomId>/` スコープで登録され、manifest もルーム単位。同一端末で複数ルームを使うと、ルームごとに別の購読（endpoint）ができる。
3. **HTTPS**: 既定は `http`（localhost 用）。Web Push はスマホ等の実機では HTTPS が必要。`ssl_cert/server.key` が git に含まれている。
4. **`root/index.html`** のルーム一覧は `tmp` のみ固定。ルームの作成・一覧機能はない。
5. **ルームの乱造（チャット機能のリスク）**: 11.10 を参照。
6. **旧データ**: 旧版の `database/subscriptionDB.db` と、旧名の Service Worker（`sw_kizu-cha.js`）の登録は引き継がない。端末側で再購読が必要。

## 11. チャット機能の仕様（実装済み）

> 前面表示の端末を通知から除く仕組みは、12章の実装で廃止した。

### 11.1 目的と範囲

- 同じルームの利用者どうしでテキストチャットをする。
- 投稿されると、そのルームで Web Push を購読している全員に通知する（投稿者自身の端末を除く。キーワードでの絞り込みは12章）。
- 今回のフェーズに含めない拡張: 通知先の指定、キーワードによる受信フィルタ。これらを後から追加できる構造にしておく。

### 11.2 方針

1. 「投稿」と「配信」を分ける。投稿はメッセージとして保存し、配信は宛先決定の関数を通す。
2. 宛先・キーワード用の項目を、今回は使わないが予約しておく。
3. 端末の識別子 `clientId` は非公開とし、他の利用者には公開用の `senderId` だけを見せる。
4. 通知を出すかどうかの判断はサーバ側に集め、Service Worker は受け取った通知を必ず表示する。
5. 既存の「送信」ボタン（固定文言）と `push:send` イベントは、チャット投稿に置き換えて廃止する。

### 11.3 データモデル

メッセージ（新規ストア `server/messages.js`、`database/messages.db`）:

| 項目 | 型 | 内容 |
|---|---|---|
| `_id` | string | nedb が付与。クライアントへは `id` として送り、重複排除に使う |
| `roomId` | string | ルーム名 |
| `clientId` | string | 投稿者の端末識別子。**サーバ内のみ。クライアントへは送らない** |
| `senderId` | string | 公開用の投稿者 ID。`clientId` の SHA-256 の先頭8文字 |
| `name` | string | 投稿時の表示名 |
| `body` | string | 本文 |
| `createdAt` | number | サーバ時刻（ミリ秒）。並び順の基準。同時刻は `_id` で補う |
| `to` | null | 予約。`null` は全員宛て。将来は `senderId` の配列 |

購読（既存の購読ストアを拡張）:

| 項目 | 内容 |
|---|---|
| `clientId` | 実装済み。購読した端末の識別子。投稿者の端末を通知から除く判定に使う |

保存期間: ルームごとに最新1000件。保存のたびに、新しい順で1000件を超えた分を削除する。nedb は追記型でファイルが肥大するため、`setAutocompactionInterval` で定期的に圧縮する。

### 11.4 Socket.IO イベント

| 方向 | イベント | データ | 処理 |
|---|---|---|---|
| C→S | `chat:post` | `{body, name}` | 検証 → 保存 → `roomId` のルーム全員へ `chat:message` を配信 → Web Push 配信 |
| S→C | `chat:message` | `{id, senderId, name, body, createdAt}` | 画面に追加。`clientId` は含めず `senderId` を含める。投稿者自身にも届く |
| S→C | `chat:history` | 上と同じ形のメッセージ配列（古い順、直近50件） | **接続のたびに**本人だけへ送る（`session:ready` の後）。クライアントは `_id` で重複を除いて合流させる |

- 表示名は `chat:post` のたびに送る。接続に状態を持たせない（`profile:update` は設けない）。
- 失敗は別イベントではなく確認応答で返す: `{ok: false, error}`。エラーは `invalid_body`、`invalid_name`、`rate_limited`。
- `session:ready` は `{senderId}` を伴い、クライアントは自分の投稿を見分けるのに使う。
- ルームと投稿者は接続時の `roomId` / `clientId` を使い、クライアントからは受け取らない。

### 11.5 通知の配信

宛先は `resolveRecipients` の1か所で決める。絞り込みの順序と引数は12.7 を参照。投稿者自身の端末は除く。

通知ペイロード（JSON、4KB 以下）:

```json
{ "title": "<ルーム名> / <表示名>", "body": "<本文の先頭100文字>", "url": "/kc/<roomId>/", "tag": "<roomId>", "messageId": "..." }
```

- Service Worker は受け取った通知を**必ず表示する**（Safari/iOS は、通知を出さないと購読が失効することがあるため）。
- 通知の `tag` はルーム名にして `renotify: true` を付ける。同じルームの通知は置き換わるが、毎回音や振動で知らせる。

### 11.6 画面

- 表示名の入力欄（`localStorage` に保存。初期値は「ゲスト」+ `clientId` 先頭4文字）。重複は認め、`senderId` 由来の色と短い ID で見分ける。
- メッセージ一覧（表示名、時刻、本文）。自分の投稿は `senderId` が自分のものと同じかで見分ける。
- 本文の入力欄と送信ボタン。Enter で送信し、変換中（`event.isComposing`）は送信しない。
- 送信状態を表示する（送信中 / 失敗）。確認応答にタイムアウトを設け、切断中の投稿は失敗として扱う。
- 既存の「購読」「購読解除」と購読状態の表示は残す。「送信」ボタン（固定文言）は廃止する。
- 本文と表示名は `textContent` で描画し、HTML として解釈しない（XSS 対策）。

### 11.7 制限と検証

- 本文: 文字列で、前後の空白を除いて1〜500文字。空白だけは拒否する。
- 表示名: 文字列で、1〜20文字。
- 長さは `[...text].length`（コードポイント数）で数える。
- 連投制限: 接続元 IP + `clientId` をキーに、10秒に5件まで。超えた分は破棄し `rate_limited` を返す。メモリ上の時間窓で管理する。

### 11.8 認証

- 認証は設けない。ルーム名を知っていれば誰でも参加でき、履歴も読める。
- ルーム名の形式は現状のまま（短い名前も可）。推測されたくない場合は、利用者が長い名前を付ける運用とし、コードでは強制しない。
- 将来パスコードが必要になれば、接続時の `roomId` 確認に追加する。

### 11.9 ファイル構成

```
server/
  socket.js            接続の検証、handle ヘルパー（既存）
  handlers/push.js     push:subscribe / push:unsubscribe（socket.js から移す）
  handlers/chat.js     chat:post、chat:history の送信
  messages.js          メッセージストア（保存、直近N件の取得、古いものの削除）
  rate-limiter.js      連投制限
  recipients.js        宛先決定（引数を変更）
src/
  chat.js              投稿、受信、描画
test/
  messages.test.js、rate-limiter.test.js、recipients.test.js
```

`push:send` と、画面の「送信」ボタンは削除する。

### 11.10 既知のリスク（今回は対応しない）

- **ルームの乱造**: 認証がなく、任意の有効なルーム名で参加できるため、悪意のある利用者が多数のルームを作り、各1000件のメッセージを保存できる。nedb は全データをメモリに載せるので、メモリとディスクを圧迫しうる。連投制限（11.7）は緩和にとどまり、根本対策ではない。
- 今後の対策案: 保存メッセージ総数の上限、上限超過時に古いルームから削除、ルーム作成の許可制。
- `clientId` は自己申告で、ブラウザの保存領域を消すと変わる。変わると、投稿者自身の端末にも通知が届くことがある。

### 11.11 受け入れ条件

1. 同じルームの2端末で、一方の投稿がもう一方に即時表示される。
2. 別のルームには届かない。
3. 購読中の他端末に通知が届き、投稿者自身の端末には届かない。
4. ページを前面で開いている端末にも、背面や閉じている端末にも通知が届く。
5. ページを閉じていても通知が届き、クリックでルームが開く。
6. 後から入室した人と、再接続した人に、直近50件が表示される（重複しない）。
7. 他の利用者に `clientId` が見えない（`senderId` のみ）。
8. 不正な入力（空文字、空白のみ、501文字以上、連投）でサーバが落ちない。
9. 失効した購読（404/410）は DB から削除される。
10. ルームごとの履歴が1000件を超えたら、古いものから削除される。

### 11.12 実装メモ（仕様との差分・補足）

- `push:send` と画面の「送信」ボタン（固定文言）は廃止した。
- 連投制限は、本文・表示名の検証より前に判定する。検証エラーの投稿も回数に数える。
- Enter 送信は `<form>` の submit で実現している。変換確定の Enter では submit が発生しないため、`isComposing` の個別判定はしていない。
- 画面に保持するメッセージは最大1000件。それを超えた古いものは表示から外す。
- 通知の送信結果（成功/失敗の件数）はサーバのログに出す。投稿の成否には影響させない。

## 12. キーワード通知の仕様（実装済み）

### 12.1 目的と基本の動き

利用者は、通知の受け方を2つから選ぶ。

| モード | 通知が届く投稿 |
|---|---|
| `all`（既定） | すべての投稿 |
| `keywords` | 登録したキーワードのどれかを含む投稿だけ |

- 絞り込むのは通知だけで、チャット画面にはすべての投稿を表示する。
- 投稿者自身の端末には通知しない。
- **ブラウザを前面で表示している端末にも通知する**（11章からの変更）。
- 通知を止めるには「購読解除」を使う。

### 12.2 11章からの変更

- 前面表示の判定（`presence:update`、`server/presence.js`、`src/presence.js`）は廃止した。11章の記述も更新済み。
- 購読の `keywords`（予約項目）は削除した。設定は購読と別に保存する（購読解除や再購読で消えないようにするため）。古い購読データに残る `keywords` は使わない。

### 12.3 データモデル

通知設定（`server/preferences.js`、`database/preferences.db`）。1件 = ルーム × 端末。

| 項目 | 型 | 内容 |
|---|---|---|
| `_id` | string | `roomId` と `clientId` から作る固定 ID（upsert） |
| `roomId` | string | ルーム名 |
| `clientId` | string | 端末の識別子。サーバ内のみ |
| `mode` | string | `all` または `keywords` |
| `keywords` | string[] | 登録した語。`all` モードでも保持する |

- 設定がない端末は `all` として扱う（データ移行は不要）。
- ログインがないため、同じ人でもブラウザや端末ごとに別の設定になる。
- キーワードは他の利用者に送らない。

### 12.4 一致の判定（`server/keyword-matcher.js`）

- 部分一致。複数のキーワードは、どれか1つを含めば一致（OR）。
- 本文とキーワードを NFKC で正規化してから小文字にする（全角・半角、大文字・小文字を区別しない）。
- ひらがなとカタカナ、漢字と仮名は区別する。
- 対象は本文の全体（通知に載せる先頭100文字に限らない）。表示名は対象外。
- 正規表現は使わない。

### 12.5 入力の制限

- `keywords` は文字列の配列で、1設定あたり10個まで。
- 各キーワードは前後の空白を除いて1〜30文字（コードポイント数）。空白だけの語は除く。
- 正規化後に同じになる語は、先に登録した1つにまとめる。
- `keywords` モードでキーワードが0個の保存は拒否する。`all` モードは0個でもよい。

### 12.6 Socket.IO イベント

| 方向 | イベント | データ | 処理 |
|---|---|---|---|
| S→C | `preferences:current` | `{mode, keywords}` | 接続のたびに、保存済みの設定（なければ既定値）を本人へ送る |
| C→S | `preferences:update` | `{mode, keywords}` | 検証して保存する。成功は `{ok: true, mode, keywords}`（整形後の内容） |

エラーは `invalid_mode`、`invalid_keywords`（型、個数、長さ）、`keywords_required`。ルームと端末は接続時の `roomId` / `clientId` を使う。

### 12.7 通知の配信

`resolveRecipients(subscriptions, message, { preferences })` で、次の順に絞る。`preferences` は、そのルームの通知設定（`clientId` → `{mode, keywords}`）。戻り値は `{entry, matchedKeywords}` の配列。

1. 同じルームの購読を取り出す。
2. 投稿者自身の端末を除く。
3. `keywords` モードの端末は、本文が一致する場合だけ残す。

通知の内容は受信者ごとに作る。`keywords` モードで一致した場合は、タイトルの先頭に一致した語を付ける（例: `[休講・締切] <ルーム名> / <表示名>`。登録順）。`all` モードのタイトルは11章のまま。

### 12.8 画面

- 通知の受け方の選択（すべて / キーワードのみ）、キーワードの追加と削除、保存ボタン。
- 表示するのはサーバに保存された内容。保存に失敗したら、その旨を表示する。
- 未購読でも設定できる。その場合は「通知を受けるには購読が必要です」と表示する。
- 「部分一致のため、`AI` は `mail` にも一致する」という注意書きを入れる。
- キーワードは `textContent` で描画する。
- 「現在の設定」にはサーバに保存された内容だけを表示し、未保存の変更があることは別に表示する。再接続しても、編集中の内容は上書きしない。
- 入力欄に残った語は、「保存」を押すと一覧に追加してから保存する。

### 12.9 今後の拡張（今回は実装しない）

- **宛先指定**: 詳細は今後検討する。
- **必ず通知する投稿**: 資格のある利用者（管理者やパワーユーザなど。区分は未定）が、受信者のキーワード設定にかかわらず通知できるようにする。
  - `resolveRecipients` では、この指定がある投稿は手順3（キーワードの絞り込み）を適用しない。
  - 購読していない端末には届けられない。
  - 前提として、資格を確認する認証が必要になる。現状は認証がなく、`clientId` は自己申告でなりすませるため、クライアントの申告だけで資格を認めてはならない（11.8 の「認証なし」の方針を見直す）。
  - 指定の有無はサーバが資格を確認してから決める。

### 12.10 ファイル構成

```
server/
  preferences.js          通知設定の保存
  keyword-matcher.js      正規化と一致判定（純粋な関数）
  handlers/preferences.js preferences:update と、接続時の送信
  recipients.js           キーワードの条件を追加
src/
  preferences.js          設定画面
test/
  preferences.test.js、keyword-matcher.test.js、recipients.test.js、message-format.test.js
```

### 12.11 受け入れ条件

1. 設定していない端末には、他の利用者のすべての投稿が通知される。
2. `keywords` モードでは、一致する投稿だけが通知され、一致しない投稿は通知されない。
3. 全角・半角と大文字・小文字の違いは一致し、ひらがなとカタカナの違いは一致しない。
4. 本文の101文字目以降にある語でも一致し、タイトルに一致した語が表示される。
5. ブラウザを前面で表示していても通知される。投稿者自身の端末には通知されない。
6. `all` に切り替えてから `keywords` に戻しても、キーワードが残る。
7. 購読解除して再購読しても、サーバを再起動しても、設定が残る。
8. `keywords` モードで0個の保存や、上限を超える入力は拒否され、サーバは落ちない。
9. 別のルームの設定は影響しない。他の利用者にキーワードは見えない。
10. チャット画面には、設定にかかわらずすべての投稿が表示される。
