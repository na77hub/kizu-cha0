import assert from "node:assert/strict";
import { test } from "node:test";
import { createPresence } from "../server/presence.js";

test("presence: 前面表示中の clientId をルームごとに返す", () => {
  const presence = createPresence();
  presence.set({ socketId: "s1", roomId: "r1", clientId: "a", visible: true });
  presence.set({ socketId: "s2", roomId: "r1", clientId: "b", visible: false });
  presence.set({ socketId: "s3", roomId: "r2", clientId: "c", visible: true });

  assert.deepEqual([...presence.visibleClientIds("r1")], ["a"]);
  assert.deepEqual([...presence.visibleClientIds("r2")], ["c"]);
});

test("presence: 同じ clientId の接続のどれかが前面なら前面表示中", () => {
  const presence = createPresence();
  presence.set({ socketId: "s1", roomId: "r", clientId: "a", visible: false });
  presence.set({ socketId: "s2", roomId: "r", clientId: "a", visible: true });
  assert.equal(presence.visibleClientIds("r").has("a"), true);

  presence.remove("s2");
  assert.equal(presence.visibleClientIds("r").has("a"), false);
});

test("presence: visible が true 以外なら前面とみなさない", () => {
  const presence = createPresence();
  presence.set({ socketId: "s1", roomId: "r", clientId: "a", visible: "yes" });
  assert.equal(presence.visibleClientIds("r").size, 0);
});
