### kizu-cha0

## 手順

# 必要なモジュールのインストール
npm install

# VAPIDの取得
node -e "const webpush=require('web-push'); const keys=webpush.generateVAPIDKeys(); console.log(JSON.stringify(keys,null,2));"

出力結果を（以下のようなもの）、
{
  "publicKey": "BNxyz...（長い文字列）",
  "privateKey": "abc123...（長い文字列）"
}

.env に入力する。




