import assert from "node:assert/strict";
import { test } from "node:test";
import { createMessageStore } from "../server/messages.js";

const post = (store, roomId, body) =>
  store.add({ roomId, clientId: "c", senderId: "s", name: "n", body });

test("messages: 古い順に直近 limit 件を返す", async () => {
  const store = createMessageStore();
  for (const body of ["1", "2", "3", "4"]) await post(store, "r", body);

  const recent = await store.findRecent("r", 3);
  assert.deepEqual(
    recent.map((message) => message.body),
    ["2", "3", "4"],
  );
});

test("messages: 同じミリ秒の投稿でも順序が保たれる", async () => {
  const store = createMessageStore();
  const bodies = Array.from({ length: 20 }, (_, index) => String(index));
  for (const body of bodies) await post(store, "r", body);

  const recent = await store.findRecent("r", 20);
  assert.deepEqual(
    recent.map((message) => message.body),
    bodies,
  );
});

test("messages: ルームごとに分かれる", async () => {
  const store = createMessageStore();
  await post(store, "a", "in-a");
  await post(store, "b", "in-b");

  assert.deepEqual(
    (await store.findRecent("a", 10)).map((message) => message.body),
    ["in-a"],
  );
});

test("messages: maxPerRoom を超えた古いメッセージを削除する", async () => {
  const store = createMessageStore({ maxPerRoom: 3 });
  for (const body of ["1", "2", "3", "4", "5"]) await post(store, "r", body);
  await post(store, "other", "x");

  const recent = await store.findRecent("r", 10);
  assert.deepEqual(
    recent.map((message) => message.body),
    ["3", "4", "5"],
  );
  assert.equal((await store.findRecent("other", 10)).length, 1);
});
