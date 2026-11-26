// server/recipients.js
import { findMatchedKeywords } from "./keyword-matcher.js";

// 通知の宛先を決める。宛先指定などは、ここに条件を足して実現する。
//   subscriptions: そのルームの購読
//   message:       投稿されたメッセージ（clientId と body を持つ）
//   preferences:   clientId -> { mode, keywords }。ない端末は all とみなす
// 戻り値は { entry, matchedKeywords } の配列。matchedKeywords は keywords モードで一致した語。
export function resolveRecipients(subscriptions, message, { preferences = new Map() } = {}) {
  return subscriptions
    .filter((entry) => entry.clientId !== message.clientId)
    .flatMap((entry) => {
      const preference = preferences.get(entry.clientId);
      if (preference?.mode !== "keywords") return [{ entry, matchedKeywords: [] }];

      const matchedKeywords = findMatchedKeywords(preference.keywords, message.body);
      return matchedKeywords.length > 0 ? [{ entry, matchedKeywords }] : [];
    });
}
