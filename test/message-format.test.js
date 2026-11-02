import assert from "node:assert/strict";
import { test } from "node:test";
import { toNotificationPayload, toPublicMessage } from "../server/message-format.js";
import { toSenderId } from "../server/sender-id.js";

const message = {
  _id: "m1",
  roomId: "tmp",
  clientId: "secret-client-id",
  senderId: "abcd1234",
  name: "太郎",
  body: "こんにちは",
  createdAt: 1000,
  to: null,
};

test("toPublicMessage: clientId を含めない", () => {
  const publicMessage = toPublicMessage(message);
  assert.equal("clientId" in publicMessage, false);
  assert.equal(JSON.stringify(publicMessage).includes("secret-client-id"), false);
  assert.equal(publicMessage.id, "m1");
  assert.equal(publicMessage.senderId, "abcd1234");
});

test("toNotificationPayload: 本文は先頭100文字、tag はルーム名", () => {
  const payload = toNotificationPayload({ ...message, body: "あ".repeat(150) });
  assert.equal([...payload.body].length, 100);
  assert.equal(payload.title, "tmp / 太郎");
  assert.equal(payload.tag, "tmp");
  assert.equal(payload.url, "/kc/tmp/");
  assert.equal(payload.messageId, "m1");
});

test("toSenderId: 8桁の16進で、同じ入力から同じ値になる", () => {
  const id = toSenderId("123e4567-e89b-12d3-a456-426614174000");
  assert.match(id, /^[0-9a-f]{8}$/);
  assert.equal(id, toSenderId("123e4567-e89b-12d3-a456-426614174000"));
  assert.notEqual(id, toSenderId("123e4567-e89b-12d3-a456-426614174001"));
});
