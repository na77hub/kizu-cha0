import assert from "node:assert/strict";
import { test } from "node:test";
import { createPreferenceStore, parsePreference } from "../server/preferences.js";

test("parsePreference: 空白を除き、正規化して同じ語は先の表記にまとめる", () => {
  const result = parsePreference({ mode: "keywords", keywords: [" ABC ", "ａｂｃ", "  ", "雨"] });
  assert.deepEqual(result.value, { mode: "keywords", keywords: ["ABC", "雨"] });
});

test("parsePreference: keywords モードの0個は拒否し、all は許可する", () => {
  assert.equal(parsePreference({ mode: "keywords", keywords: [" "] }).error, "keywords_required");
  assert.deepEqual(parsePreference({ mode: "all", keywords: [] }).value, {
    mode: "all",
    keywords: [],
  });
});

test("parsePreference: 不正な入力を拒否する", () => {
  const errorOf = (input) => parsePreference(input).error;
  const words = (count) => Array.from({ length: count }, (_, index) => `w${index}`);

  assert.equal(errorOf(undefined), "invalid_mode");
  assert.equal(errorOf({ mode: "none", keywords: [] }), "invalid_mode");
  assert.equal(errorOf({ mode: "all", keywords: "abc" }), "invalid_keywords");
  assert.equal(errorOf({ mode: "all", keywords: [1] }), "invalid_keywords");
  assert.equal(errorOf({ mode: "all", keywords: ["a".repeat(31)] }), "invalid_keywords");
  assert.equal(errorOf({ mode: "all", keywords: words(11) }), "invalid_keywords");
  assert.equal(errorOf({ mode: "all", keywords: Array(101).fill("a") }), "invalid_keywords");
  assert.equal(errorOf({ mode: "all", keywords: words(10) }), undefined);
  assert.equal(errorOf({ mode: "all", keywords: ["😀".repeat(30)] }), undefined);
});

test("preferenceStore: 既定値は all、保存は上書きし、ルームごとに分かれる", async () => {
  const store = createPreferenceStore();
  assert.deepEqual(await store.get("r", "a"), { mode: "all", keywords: [] });

  await store.save({ roomId: "r", clientId: "a", mode: "keywords", keywords: ["x"] });
  await store.save({ roomId: "r", clientId: "a", mode: "all", keywords: ["x"] });

  assert.deepEqual(await store.get("r", "a"), { mode: "all", keywords: ["x"] });
  assert.deepEqual(await store.get("other", "a"), { mode: "all", keywords: [] });
  assert.equal((await store.findByRoom("r")).size, 1);
  assert.equal((await store.findByRoom("other")).size, 0);
});
