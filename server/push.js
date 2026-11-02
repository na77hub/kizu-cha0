// server/push.js
import webpush from "web-push";
import { resolveRecipients } from "./recipients.js";

const EXPIRED_STATUS_CODES = [404, 410];

export function createPushService({ vapid, proxyUrl, subscriptionStore }) {
  webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);

  const sendOptions = proxyUrl ? { proxy: proxyUrl } : {};

  // roomId の購読者全員（excludeClientId を除く）に通知する。
  async function sendToRoom(roomId, payload, { excludeClientId } = {}) {
    const entries = await subscriptionStore.findByRoom(roomId);
    const recipients = resolveRecipients(entries, { excludeClientId });
    const body = JSON.stringify(payload);

    const results = await Promise.allSettled(
      recipients.map(async (entry) => {
        try {
          await webpush.sendNotification(entry.subscription, body, sendOptions);
        } catch (error) {
          if (EXPIRED_STATUS_CODES.includes(error.statusCode)) {
            await subscriptionStore.removeById(entry._id);
          }
          throw error;
        }
      }),
    );

    const failed = results.filter((result) => result.status === "rejected");
    failed.forEach((result) => console.error("WebPush send error:", result.reason));
    return { sent: results.length - failed.length, failed: failed.length };
  }

  return { sendToRoom };
}
