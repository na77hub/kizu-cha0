// server/socket.js
import { Server } from "socket.io";
import {
  isValidClientId,
  isValidEndpoint,
  isValidRoomId,
  isValidSubscription,
  isValidText,
} from "./validators.js";

const MAX_PUSH_BODY_LENGTH = 200;

// 確認応答（ack）で結果を返す。クライアントが ack を渡していなければ何もしない。
function reply(ack, result) {
  if (typeof ack === "function") ack(result);
}

export function attachSocketServer(httpServer, { subscriptionStore, pushService }) {
  const io = new Server(httpServer);

  io.use((socket, next) => {
    const { roomId, clientId } = socket.handshake.query;
    if (!isValidRoomId(roomId) || !isValidClientId(clientId)) {
      return next(new Error("invalid_query"));
    }
    socket.data.roomId = roomId;
    socket.data.clientId = clientId;
    return next();
  });

  io.on("connection", (socket) => {
    const { roomId, clientId } = socket.data;
    socket.join(roomId);

    // 失敗してもサーバは落とさず、ack で理由を返す。
    function handle(eventName, handler) {
      socket.on(eventName, async (...args) => {
        // payload を省略すると ack が先頭に来るため、最後の関数を ack として取り出す。
        const ack = typeof args.at(-1) === "function" ? args.pop() : undefined;
        const payload = args[0] ?? {};
        try {
          reply(ack, await handler(payload));
        } catch (error) {
          console.error(`${eventName} failed:`, error);
          reply(ack, { ok: false, error: "internal_error" });
        }
      });
    }

    handle("push:subscribe", async ({ subscription }) => {
      if (!isValidSubscription(subscription)) return { ok: false, error: "invalid_subscription" };
      await subscriptionStore.save({ roomId, clientId, subscription });
      return { ok: true };
    });

    handle("push:unsubscribe", async ({ endpoint }) => {
      if (!isValidEndpoint(endpoint)) return { ok: false, error: "invalid_endpoint" };
      await subscriptionStore.remove({ roomId, endpoint });
      return { ok: true };
    });

    // チャット機能（chat:post）で置き換える予定の暫定イベント。
    handle("push:send", async ({ body }) => {
      if (!isValidText(body, MAX_PUSH_BODY_LENGTH)) return { ok: false, error: "invalid_body" };
      const result = await pushService.sendToRoom(roomId, {
        title: "新着通知",
        body,
        url: `/kc/${roomId}/`,
      });
      return { ok: true, ...result };
    });

    socket.emit("session:ready");
  });

  return io;
}
