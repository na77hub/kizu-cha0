# kizu-cha0 仕様書

現状のコード（ブランチ `wktk-dev`、コミット 864e60a 時点）を読み取って整理したもの。「現状」は実装済みの挙動、「既知の問題・未実装」は今後の機能追加時に注意すべき点。

## 1. 概要

kizu-cha0 は、Web Push を使って「ルーム」に参加している端末へ通知を送る Web アプリ。

- 参加者はルームの URL（`/kc/<room>/`）を開き、「購読」ボタンで Web Push を有効にする。
- 誰かが「送信」ボタンを押すと、同じルームの購読端末すべてに通知が届く。
- ブラウザを閉じていても、Service Worker が通知を表示する。
- ログイン機能はなく、ルーム名を知っていれば誰でも参加・送信できる。

## 2. 技術構成

| 区分 | 使用技術 |
|---|---|
| サーバ | Node.js (ESM) / Express 5 / Socket.IO 4 / web-push / @seald-io/nedb |
| クライアント | jQuery 4 / socket.io-client / Service Worker / Push API |
| ビルド | Vite 8（`src/` → `public/`）、vite-plugin-static-copy |
| その他 | compression, serve-favicon, qrcode, dotenv |

起動: `npm run build-client`（クライアントのビルド）→ `npm start`（`node app.js`）。

## 3. ディレクトリ構成

| パス | 内容 |
|---|---|
| `app.js` | サーバ本体（HTTP/HTTPS、Socket.IO、Web Push 送信、DB） |
| `conf.js` | ポート・パス・ディレクトリ・ファイルの設定 |
| `src/` | クライアントのソース（`index.html`, `script.js`, `sw_kizu-cha.js`） |
| `public/` | Vite のビルド出力（git 管理外）。`/kc/:room/` で配信 |
| `root/` | サイトルート `/` で配信する静的ファイル（ルーム一覧ページ、起動時生成の QR コード `2Dcode.png`） |
| `image/` | ファビコン・アイコン（`/image/` で配信） |
| `ssl_cert/` | HTTPS 用の証明書・鍵 |
| `database/` | nedb のデータ（`subscriptionDB.db`、自動作成、git 管理外） |
| `room_data/` | ルーム別データ用ディレクトリ（自動作成、現状未使用） |

## 4. 設定

### 4.1 `conf.js`

| 項目 | 値 | 意味 |
|---|---|---|
| `protcol` | `"http"` | `"https"` で HTTPS 起動（変数名は `protcol` で綴りが違う点に注意） |
| `port` | `50091` | サーバのポート |
| `webRootPath` | `/` | 静的サイトのルートパス |
| `kcRootPath` | `/kc/` | ルームのルートパス |

### 4.2 環境変数（`.env`）

| 変数 | 用途 |
|---|---|
| `VAPID_SUBJECT` | VAPID の連絡先（`mailto:` または `https://`） |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | サーバ側 VAPID 鍵 |
| `VITE_VAPID_PUBLIC_KEY` | クライアントに埋め込む公開鍵（ビルド時に反映） |
| `http_proxy` | 設定されていれば Web Push 送信時にプロキシ経由 |

## 5. HTTP ルーティング（`app.js`）

| パス | 動作 |
|---|---|
| `GET /` ほか | `root/` の静的ファイル（ルーム一覧ページ） |
| `GET /image/*` | `image/` の静的ファイル |
| `GET /kc/:room` | `public/index.html` を返す（ルーム画面） |
| `GET /kc/:room/manifest.webmanifest` | ルーム名入りの Web App Manifest を動的生成（standalone 表示、192px アイコン） |
| `GET /kc/:room/lib/*`, `/icon/*` | `libDir` / `iconDir` から配信（`conf.js` で未定義のため現状は動作しない） |
| `GET /kc/:room/*` | `public/` 配下のファイル（JS、`sw_kizu-cha.js` など）、無ければ 404 |

- ルーム名の検証（`/kc/:room` 全体のミドルウェア）: 空文字、および `\ / : * ? " < > | .` を含む場合は 500。
- 起動時に最初の IPv4 アドレスの URL を QR コード化し、`root/2Dcode.png` に保存する。

## 6. クライアント仕様

### 6.1 画面（`src/index.html`）

- タイトル「kizu-cha ZERO」
- `Room:<ルーム名>` 表示（URL の `/kc/` の次のセグメントから取得）
- `Web Push:true/false` 表示（購読状態）
- ボタン: 「購読」「購読解除」「送信」

### 6.2 動作（`src/script.js`）

1. 読み込み時にルーム名を取得し、購読状態を表示、Socket.IO に接続する。
2. **購読**: Service Worker（`./sw_kizu-cha.js`）を登録して `ready` を待つ → 既存購読がなければ `VITE_VAPID_PUBLIC_KEY` で `pushManager.subscribe`（`userVisibleOnly: true`）→ `subscription for web push` をサーバへ送る。
3. **購読解除**: ブラウザ側で `unsubscribe()` し、成功したら `unsubscription from web push` をサーバへ送る。Service Worker 自体の登録は残す。
4. **送信**: `send web push to room` を `{room, message: "こんにちは、kizu-cha ZEROです！"}` で送る（メッセージは固定文字列）。
5. ボタン操作のたびに購読状態表示を更新する。

### 6.3 Service Worker（`src/sw_kizu-cha.js`）

`push` イベントを受け取り、ペイロード本文をそのまま `body` に、タイトル `kizu-cha0`、アイコンとバッジに `/image/favicon-128x128.png` を指定して通知を表示する。クリック処理などはない。

## 7. Socket.IO イベント仕様

接続時にクライアントの `query.room` でルームに join する想定（後述の問題あり）。サーバは接続完了後 `connected` を emit する。

| 方向 | イベント | データ | サーバの処理 |
|---|---|---|---|
| C→S | `subscription for web push` | `{subscription, room}` | `subscription.endpoint` と `room` の組が未登録なら DB に insert、登録済みならスキップ |
| C→S | `unsubscription from web push` | `{subscription, room}` | 同じ endpoint + room の購読を DB から削除 |
| C→S | `send web push to room` | `{room, message}` | そのルームの全購読を検索し、`{title:"新着通知", body: message}` を JSON で Web Push 送信 |
| S→C | `connected` | なし | 接続完了の通知（クライアントはログ出力のみ） |

送信時に HTTP 410 が返った購読は DB から削除する。

## 8. データモデル

nedb（`database/subscriptionDB.db`）の 1 ドキュメント = 1 端末 × 1 ルーム。

```json
{
  "_id": "nedb が付与",
  "room": "tmp",
  "subscription": {
    "endpoint": "https://...",
    "expirationTime": null,
    "keys": { "p256dh": "...", "auth": "..." }
  }
}
```

## 9. 通知フロー

```
[端末A] 購読 ──subscription──▶ [サーバ] ──insert──▶ DB
[端末B] 送信 ──send web push──▶ [サーバ] ──find(room)──▶ DB
                                   └─ web-push ─▶ プッシュサービス ─▶ [端末A,B…] Service Worker ─▶ 通知表示
```

## 10. 既知の問題・未実装（機能追加前の確認事項）

1. **ルーム join が機能していない**: クライアントは `io.connect()` で `query` を渡していないため、サーバの `socket.room` / `socket.uuid` は `undefined`。Socket.IO のルーム分離は使われておらず、通知先は DB の `room` 値だけで決まる。
2. **接続チェックのバグ**: `!"uuid" in query` は `(!"uuid") in query` と解釈され常に偽になるため、検証として働かない（`uuid` 側は `return` もない）。
3. **認証・認可なし**: ルーム名を知っていれば誰でも購読・送信できる。`data.room` もクライアント申告の値をそのまま信用している。
4. **入力検証なし**: `message` の長さや型、`data.subscription` の存在確認がない（不正データでサーバ例外になりうる）。
5. **通知本文が固定**: 送信ボタンのメッセージは固定文字列。入力 UI や送信者情報はない。
6. **Service Worker の不備**: `event.data` が null の場合に `event.data.text()` で例外になる（`payload` 変数は使われていない）。通知クリック時の動作もない。
7. **購読の掃除が不完全**: 削除するのは 410 のみで、404 などの失効は残る。
8. **スコープ**: Service Worker は `/kc/<room>/` スコープで登録され、manifest もルーム単位。同一端末で複数ルームを使う場合の挙動は未検証。
9. **HTTPS**: `conf.js` は `http`（localhost 用）。Web Push はスマホ等の実機では HTTPS が必要。`ssl_cert/server.key` が git に含まれている。
10. **`root/index.html`** のルーム一覧は `tmp` のみ固定。ルームの作成・一覧機能はない。
11. **未使用コード**: `convertWebmToMp4`（ffmpeg）、`transcribeWithWhisper`（whisper）は import がコメントアウトされており呼ばれない。`libDir` / `iconDir` / `whisperModelName` は未定義。`room_data/` も未使用。
12. **README の誤り**: VAPID 鍵生成コマンドが `require` を使っているが、`package.json` が `"type": "module"` のためそのままでは動かない（`npx web-push generate-vapid-keys` などに置換が必要）。ビルド・起動手順の記載もない。
13. `package.json` の依存 `os` は Node 標準モジュールと重複しており不要。
