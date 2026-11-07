// server/recipients.js

// 通知の宛先を決める。宛先指定やキーワード絞り込みは、ここに条件を足して実現する。
//   subscriptions: そのルームの購読
//   message:       投稿されたメッセージ（clientId を持つ）
//   visibleClientIds: いま前面でルームを見ている端末
export function resolveRecipients(subscriptions, message, { visibleClientIds = new Set() } = {}) {
  return subscriptions.filter(
    (entry) => entry.clientId !== message.clientId && !visibleClientIds.has(entry.clientId),
  );
}
