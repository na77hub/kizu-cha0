// server/recipients.js

// 通知の宛先を決める。宛先指定やキーワード絞り込みは、ここに条件を足して実現する。
export function resolveRecipients(subscriptions, { excludeClientId } = {}) {
  return subscriptions.filter((entry) => !excludeClientId || entry.clientId !== excludeClientId);
}
