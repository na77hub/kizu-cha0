import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveRecipients } from "../server/recipients.js";

const entries = [
  { _id: "1", clientId: "a" },
  { _id: "2", clientId: "b" },
];

test("resolveRecipients: 除外指定がなければ全員が宛先", () => {
  assert.deepEqual(resolveRecipients(entries), entries);
});

test("resolveRecipients: 除外した端末は宛先に含まれない", () => {
  assert.deepEqual(resolveRecipients(entries, { excludeClientId: "a" }), [entries[1]]);
});
