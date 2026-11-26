import assert from "node:assert/strict";
import { test } from "node:test";
import { findMatchedKeywords } from "../server/keyword-matcher.js";

test("findMatchedKeywords: 部分一致し、登録順に返す", () => {
  assert.deepEqual(findMatchedKeywords(["締切", "休講", "雨"], "休講と締切変更"), ["締切", "休講"]);
  assert.deepEqual(findMatchedKeywords(["AI"], "mail を送る"), ["AI"]);
});

test("findMatchedKeywords: 全角・半角、大文字・小文字を区別しない", () => {
  assert.deepEqual(findMatchedKeywords(["abc"], "ＡＢＣ"), ["abc"]);
  assert.deepEqual(findMatchedKeywords(["パン"], "ﾊﾟﾝを買う"), ["パン"]);
});

test("findMatchedKeywords: ひらがなとカタカナは区別する", () => {
  assert.deepEqual(findMatchedKeywords(["ぱん"], "パン"), []);
});

test("findMatchedKeywords: 101文字目以降でも一致する", () => {
  assert.deepEqual(findMatchedKeywords(["休講"], "あ".repeat(150) + "休講"), ["休講"]);
});
