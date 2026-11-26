// server/preferences.js
import crypto from "node:crypto";
import path from "node:path";
import nedb from "@seald-io/nedb";
import { normalizeForMatch } from "./keyword-matcher.js";
import { normalizeText } from "./validators.js";

export const NOTIFICATION_MODES = ["all", "keywords"];
const MAX_KEYWORDS = 10;
const MAX_KEYWORD_LENGTH = 30;
// 重複を除く前の配列の上限。極端に大きい入力は処理せずに拒否する。
const MAX_INPUT_KEYWORDS = 100;

const createDefaultPreference = () => ({ mode: "all", keywords: [] });

// 入力を検証して整形する。成功は { value: { mode, keywords } }、失敗は { error }。
export function parsePreference({ mode, keywords } = {}) {
  if (!NOTIFICATION_MODES.includes(mode)) return { error: "invalid_mode" };
  if (!Array.isArray(keywords) || keywords.length > MAX_INPUT_KEYWORDS) {
    return { error: "invalid_keywords" };
  }

  const unique = new Map(); // 正規化した語 -> 先に登録された表記
  for (const keyword of keywords) {
    if (typeof keyword !== "string") return { error: "invalid_keywords" };
    if (keyword.trim() === "") continue;
    const trimmed = normalizeText(keyword, MAX_KEYWORD_LENGTH);
    if (trimmed === null) return { error: "invalid_keywords" };
    const key = normalizeForMatch(trimmed);
    if (!unique.has(key)) unique.set(key, trimmed);
  }

  if (unique.size > MAX_KEYWORDS) return { error: "invalid_keywords" };
  if (mode === "keywords" && unique.size === 0) return { error: "keywords_required" };
  return { value: { mode, keywords: [...unique.values()] } };
}

// 通知設定ストア。1件 = ルーム × 端末。directory を省略するとメモリ上のみ（テスト用）。
// { _id, roomId, clientId, mode, keywords }
export function createPreferenceStore({ directory } = {}) {
  const db = new nedb(
    directory ? { filename: path.join(directory, "preferences.db"), autoload: true } : {},
  );

  function createEntryId(roomId, clientId) {
    return crypto.createHash("sha256").update(`${roomId}\n${clientId}`).digest("hex").slice(0, 32);
  }

  const toPreference = ({ mode, keywords }) => ({ mode, keywords });

  return {
    async get(roomId, clientId) {
      const doc = await db.findOneAsync({ _id: createEntryId(roomId, clientId) });
      return doc ? toPreference(doc) : createDefaultPreference();
    },

    async save({ roomId, clientId, mode, keywords }) {
      const _id = createEntryId(roomId, clientId);
      await db.updateAsync({ _id }, { _id, roomId, clientId, mode, keywords }, { upsert: true });
    },

    // clientId -> { mode, keywords }
    async findByRoom(roomId) {
      const docs = await db.findAsync({ roomId });
      return new Map(docs.map((doc) => [doc.clientId, toPreference(doc)]));
    },
  };
}
