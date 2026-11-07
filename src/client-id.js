// src/client-id.js

const STORAGE_KEY = "kizu-cha-client-id";

// 端末（ブラウザ）ごとの識別子。localStorage に保存して使い回す。
export function getOrCreateClientId() {
  try {
    let clientId = localStorage.getItem(STORAGE_KEY);
    if (!clientId) {
      clientId = crypto.randomUUID();
      localStorage.setItem(STORAGE_KEY, clientId);
    }
    return clientId;
  } catch {
    return crypto.randomUUID();
  }
}
