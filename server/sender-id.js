// server/sender-id.js
import crypto from "node:crypto";

// 他の利用者に見せる投稿者 ID。clientId は非公開のまま、ここから一方向に導く。
export function toSenderId(clientId) {
  return crypto.createHash("sha256").update(clientId).digest("hex").slice(0, 8);
}
