### kizu-cha0

## 手順

# 必要なモジュールのインストール
npm install

# VAPID鍵の生成
npx web-push generate-vapid-keys

出力された Public Key / Private Key を使って、`.env.example` を `.env` にコピーして編集する。

    cp .env.example .env

- `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` : 生成した鍵
- `VAPID_SUBJECT` : `mailto:` または `https://` の連絡先
- `VITE_VAPID_PUBLIC_KEY` : クライアント用。`VAPID_PUBLIC_KEY` と同じ値を直接記入する

# クライアントのビルド（src/ → public/）
npm run build-client

# サーバの起動
npm start

# 開発・品質確認
npm run dev     # Vite の開発サーバ
npm test        # テスト
npm run lint    # ESLint
npm run format  # Prettier

`PROTOCOL`(`http`/`https`)と `PORT` は `.env` で上書きできる。

起動後、`http://localhost:50091/` を開き、ルームのリンク（`/kc/<room>/`）から参加する。
スマートフォンなどの実機で Web Push を使うには HTTPS が必要（`.env` に `PROTOCOL=https` を追加する）。
