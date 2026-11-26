// server/push.js
import webpush from "web-push";
import { toNotificationPayload } from "./message-format.js";
import { resolveRecipients } from "./recipients.js";

const EXPIRED_STATUS_CODES = [404, 410];

export function createPushService({ vapid, proxyUrl, subscriptionStore, preferenceStore }) {
  webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);

  const sendOptions = proxyUrl ? { proxy: proxyUrl } : {};

  // メッセージのルームの購読者のうち、宛先に決まった端末へ通知する。
  async function notify(message) {
    const [entries, preferences] = await Promise.all([
      subscriptionStore.findByRoom(message.roomId),
      preferenceStore.findByRoom(message.roomId),
    ]);
    const recipients = resolveRecipients(entries, message, { preferences });

    const results = await Promise.allSettled(
      recipients.map(async ({ entry, matchedKeywords }) => {
        // 一致した語は受信者ごとに違うため、内容は宛先ごとに作る。
        const body = JSON.stringify(toNotificationPayload(message, { matchedKeywords }));
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
    return {
      viaProxy: Boolean(proxyUrl),
      sent: results.length - failed.length,
      failed: failed.length,
    };
  }

  return { notify };
}
