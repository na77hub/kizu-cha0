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

// Web Push のペイロード。一致したキーワードがあれば、タイトルの先頭に付ける。
export function toNotificationPayload(message, { matchedKeywords = [] } = {}) {
  const prefix = matchedKeywords.length > 0 ? `[${matchedKeywords.join("・")}] ` : "";
  return {
    title: `${prefix}${message.roomId} / ${message.name}`,
    body: [...message.body].slice(0, NOTIFICATION_BODY_LENGTH).join(""),
    url: `/kc/${message.roomId}/`,
    tag: message.roomId,
    messageId: message._id,
  };
}
