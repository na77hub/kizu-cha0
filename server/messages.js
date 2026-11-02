// server/messages.js
import path from "node:path";
import nedb from "@seald-io/nedb";

const COMPACTION_INTERVAL_MS = 10 * 60 * 1000;

// メッセージストア。ルームごとに最新 maxPerRoom 件だけ保持する。
// directory を省略するとメモリ上のみ（テスト用）。
// { _id, roomId, clientId, senderId, name, body, createdAt, to }
export function createMessageStore({ directory, maxPerRoom = 1000 } = {}) {
  const db = new nedb(
    directory ? { filename: path.join(directory, "messages.db"), autoload: true } : {},
  );
  db.ensureIndex({ fieldName: "roomId" });
  if (directory) db.setAutocompactionInterval(COMPACTION_INTERVAL_MS);

  // 同じミリ秒の投稿でも順序が保たれるよう、createdAt を単調増加にする。
  let lastCreatedAt = 0;

  async function pruneRoom(roomId) {
    const stale = await db
      .findAsync({ roomId })
      .sort({ createdAt: -1 })
      .skip(maxPerRoom)
      .projection({ _id: 1 });
    if (stale.length > 0) {
      await db.removeAsync({ _id: { $in: stale.map((doc) => doc._id) } }, { multi: true });
    }
  }

  return {
    async add({ roomId, clientId, senderId, name, body }) {
      lastCreatedAt = Math.max(Date.now(), lastCreatedAt + 1);
      const message = await db.insertAsync({
        roomId,
        clientId,
        senderId,
        name,
        body,
        createdAt: lastCreatedAt,
        to: null,
      });
      await pruneRoom(roomId);
      return message;
    },

    // 古い順に並べた直近 limit 件。
    async findRecent(roomId, limit) {
      const recent = await db.findAsync({ roomId }).sort({ createdAt: -1 }).limit(limit);
      return recent.reverse();
    },
  };
}
