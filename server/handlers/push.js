// server/handlers/push.js
import { isValidEndpoint, isValidSubscription } from "../validators.js";

export function registerPushHandlers({ socket, handle, subscriptionStore }) {
  const { roomId, clientId } = socket.data;

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
}
