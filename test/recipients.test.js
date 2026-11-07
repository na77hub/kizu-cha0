import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveRecipients } from "../server/recipients.js";

const subscriptions = [
  { _id: "1", clientId: "a" },
  { _id: "2", clientId: "b" },
  { _id: "3", clientId: "c" },
];

test("resolveRecipients: 投稿者自身の端末は宛先に含まれない", () => {
  const result = resolveRecipients(subscriptions, { clientId: "a" });
  assert.deepEqual(result, [subscriptions[1], subscriptions[2]]);
});

test("resolveRecipients: 前面で見ている端末は宛先に含まれない", () => {
  const result = resolveRecipients(
    subscriptions,
    { clientId: "a" },
    { visibleClientIds: new Set(["b"]) },
  );
  assert.deepEqual(result, [subscriptions[2]]);
});

test("resolveRecipients: 該当がなければ空", () => {
  assert.deepEqual(resolveRecipients([], { clientId: "a" }), []);
});
