// server/message-format.js

const NOTIFICATION_BODY_LENGTH = 100;

// クライアントへ送る形。clientId は含めない。
export function toPublicMessage(message) {
  return {
    id: message._id,
    senderId: message.senderId,
    name: message.name,
    body: message.body,
    createdAt: message.createdAt,
  };
}

// Web Push のペイロード。
export function toNotificationPayload(message) {
  return {
    title: `${message.roomId} / ${message.name}`,
    body: [...message.body].slice(0, NOTIFICATION_BODY_LENGTH).join(""),
    url: `/kc/${message.roomId}/`,
    tag: message.roomId,
    messageId: message._id,
  };
}
