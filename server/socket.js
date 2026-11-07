// server/socket.js
import { Server } from "socket.io";
import { registerChatHandlers } from "./handlers/chat.js";
import { registerPushHandlers } from "./handlers/push.js";
import { isValidClientId, isValidRoomId } from "./validators.js";

// 確認応答（ack）で結果を返す。クライアントが ack を渡していなければ何もしない。
function reply(ack, result) {
  if (typeof ack === "function") ack(result);
}

// イベントハンドラを登録する。失敗してもサーバは落とさず、ack で理由を返す。
function createHandle(socket) {
  return function handle(eventName, handler) {
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
  };
}

export function attachSocketServer(httpServer, services) {
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
    const handle = createHandle(socket);
    socket.join(socket.data.roomId);

    registerPushHandlers({ socket, handle, ...services });
    const chat = registerChatHandlers({ io, socket, handle, ...services });

    socket.emit("session:ready", { senderId: chat.senderId });
    chat.sendHistory().catch((error) => console.error("chat:history failed:", error));
  });

  return io;
}
