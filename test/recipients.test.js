import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveRecipients } from "../server/recipients.js";

const subscriptions = [
  { _id: "1", clientId: "a" },
  { _id: "2", clientId: "b" },
  { _id: "3", clientId: "c" },
];
const idsOf = (recipients) => recipients.map(({ entry }) => entry.clientId);

test("resolveRecipients: 設定がなければ、投稿者以外の全員が宛先", () => {
  const result = resolveRecipients(subscriptions, { clientId: "a", body: "x" });
  assert.deepEqual(idsOf(result), ["b", "c"]);
  assert.deepEqual(result[0].matchedKeywords, []);
});

test("resolveRecipients: keywords モードは一致した場合だけ宛先になる", () => {
  const preferences = new Map([
    ["b", { mode: "keywords", keywords: ["休講", "締切"] }],
    ["c", { mode: "keywords", keywords: ["雨"] }],
  ]);
  const result = resolveRecipients(
    subscriptions,
    { clientId: "a", body: "締切の前に休講" },
    { preferences },
  );
  assert.deepEqual(idsOf(result), ["b"]);
  assert.deepEqual(result[0].matchedKeywords, ["休講", "締切"]);
});

test("resolveRecipients: all モードは保存済みのキーワードがあっても全件", () => {
  const preferences = new Map([["b", { mode: "all", keywords: ["雨"] }]]);
  const result = resolveRecipients(subscriptions, { clientId: "a", body: "晴れ" }, { preferences });
  assert.deepEqual(idsOf(result), ["b", "c"]);
  assert.deepEqual(result[0].matchedKeywords, []);
});

test("resolveRecipients: 投稿者は自分のキーワードに一致しても宛先にならない", () => {
  const preferences = new Map([["a", { mode: "keywords", keywords: ["x"] }]]);
  const result = resolveRecipients(subscriptions, { clientId: "a", body: "x" }, { preferences });
  assert.deepEqual(idsOf(result), ["b", "c"]);
});
