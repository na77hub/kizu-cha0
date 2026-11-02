import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isValidClientId,
  isValidRoomId,
  isValidSubscription,
  isValidText,
} from "../server/validators.js";

test("isValidRoomId: 空文字や禁止文字を含む名前を拒否する", () => {
  assert.equal(isValidRoomId("tmp"), true);
  assert.equal(isValidRoomId(""), false);
  assert.equal(isValidRoomId(undefined), false);
  for (const bad of ["a.b", "a/b", "a\\b", "a:b", "a*b", "a?b", 'a"b', "a<b", "a>b", "a|b"]) {
    assert.equal(isValidRoomId(bad), false, bad);
  }
});

test("isValidClientId: UUID 形式のみ許可する", () => {
  assert.equal(isValidClientId("123e4567-e89b-12d3-a456-426614174000"), true);
  assert.equal(isValidClientId("abc"), false);
  assert.equal(isValidClientId(undefined), false);
});

test("isValidSubscription: endpoint と keys が揃っているときのみ許可する", () => {
  const valid = { endpoint: "https://example.com/x", keys: { p256dh: "a", auth: "b" } };
  assert.equal(isValidSubscription(valid), true);
  assert.equal(isValidSubscription({ endpoint: valid.endpoint }), false);
  assert.equal(isValidSubscription(null), false);
});

test("isValidText: 長さの範囲を検証する", () => {
  assert.equal(isValidText("a", 3), true);
  assert.equal(isValidText("abc", 3), true);
  assert.equal(isValidText("abcd", 3), false);
  assert.equal(isValidText("", 3), false);
  assert.equal(isValidText(1, 3), false);
});
