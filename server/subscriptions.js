// server/subscriptions.js
import crypto from "node:crypto";
import path from "node:path";
import nedb from "@seald-io/nedb";

// 購読ストア。1件 = 1端末の1ルーム分の購読。
// { _id, roomId, clientId, subscription, keywords }
export function createSubscriptionStore(databaseDir) {
  const db = new nedb({ filename: path.join(databaseDir, "subscriptions.db"), autoload: true });

  // roomId と endpoint から決まる ID。同時に登録しても重複しない。
  function createEntryId(roomId, endpoint) {
    return crypto.createHash("sha256").update(`${roomId}\n${endpoint}`).digest("hex").slice(0, 32);
  }

  return {
    async save({ roomId, clientId, subscription }) {
      const _id = createEntryId(roomId, subscription.endpoint);
      await db.updateAsync(
        { _id },
        { _id, roomId, clientId, subscription, keywords: [] },
        { upsert: true },
      );
    },

    async remove({ roomId, endpoint }) {
      return db.removeAsync({ _id: createEntryId(roomId, endpoint) }, {});
    },

    async removeById(id) {
      return db.removeAsync({ _id: id }, {});
    },

    async findByRoom(roomId) {
      return db.findAsync({ roomId });
    },
  };
}
