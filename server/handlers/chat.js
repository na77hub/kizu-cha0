// server/handlers/chat.js
import { toPublicMessage } from "../message-format.js";
import { toSenderId } from "../sender-id.js";
import { normalizeText } from "../validators.js";

const MAX_BODY_LENGTH = 500;
const MAX_NAME_LENGTH = 20;
const HISTORY_LIMIT = 50;

export function registerChatHandlers({
  io,
  socket,
  handle,
  messageStore,
  pushService,
  presence,
  rateLimiter,
}) {
  const { roomId, clientId } = socket.data;
  const senderId = toSenderId(clientId);
  const rateLimitKey = `${socket.handshake.address}|${clientId}`;

  handle("chat:post", async ({ body, name }) => {
    if (!rateLimiter.tryConsume(rateLimitKey)) return { ok: false, error: "rate_limited" };

    const normalizedBody = normalizeText(body, MAX_BODY_LENGTH);
    if (normalizedBody === null) return { ok: false, error: "invalid_body" };
    const normalizedName = normalizeText(name, MAX_NAME_LENGTH);
    if (normalizedName === null) return { ok: false, error: "invalid_name" };

    const message = await messageStore.add({
      roomId,
      clientId,
      senderId,
      name: normalizedName,
      body: normalizedBody,
    });
    io.to(roomId).emit("chat:message", toPublicMessage(message));

    // 通知の失敗は投稿の成否に影響させない。
    pushService
      .notify(message, { visibleClientIds: presence.visibleClientIds(roomId) })
      .then((result) => console.log(`WebPush: sent=${result.sent} failed=${result.failed}`))
      .catch((error) => console.error("WebPush notify failed:", error));

    return { ok: true, id: message._id };
  });

  handle("presence:update", ({ visible }) => {
    presence.set({ socketId: socket.id, roomId, clientId, visible });
    return { ok: true };
  });

  socket.on("disconnect", () => presence.remove(socket.id));

  return {
    senderId,
    async sendHistory() {
      const messages = await messageStore.findRecent(roomId, HISTORY_LIMIT);
      socket.emit("chat:history", messages.map(toPublicMessage));
    },
  };
}
