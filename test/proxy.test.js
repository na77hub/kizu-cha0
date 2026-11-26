import assert from "node:assert/strict";
import { test } from "node:test";
import { describeProxy, maskProxyUrl } from "../server/proxy.js";

test("maskProxyUrl: 認証情報を伏せる", () => {
  assert.equal(maskProxyUrl("http://proxy.example:8080"), "http://proxy.example:8080");
  assert.equal(
    maskProxyUrl("http://user:secret@proxy.example:8080/"),
    "http://***@proxy.example:8080",
  );
});

test("maskProxyUrl: 解析できない値はそのまま出さない", () => {
  assert.equal(maskProxyUrl("user:secret@proxy.example:8080"), "(解析できない値)");
  assert.equal(maskProxyUrl("not a url"), "(解析できない値)");
});

test("describeProxy: http_proxy があれば使用する", () => {
  const lines = describeProxy({ http_proxy: "http://proxy.example:8080" });
  assert.equal(lines.length, 1);
  assert.match(lines[0], /使用する.*proxy\.example:8080/);
});

test("describeProxy: 未設定なら使用しない", () => {
  const lines = describeProxy({});
  assert.equal(lines.length, 1);
  assert.match(lines[0], /使用しない/);
});

test("describeProxy: 使われない変数だけがある場合は注意を出す", () => {
  const lines = describeProxy({ HTTPS_PROXY: "http://user:secret@proxy.example:8080" });
  assert.equal(lines.length, 2);
  assert.match(lines[1], /HTTPS_PROXY/);
  assert.equal(lines.join("\n").includes("secret"), false);
});
