// server/proxy.js

// Web Push の送信に使うのは小文字の http_proxy だけ。ほかの変数は設定されていても使わない。
const USED_VARIABLE = "http_proxy";
const UNUSED_VARIABLES = ["HTTP_PROXY", "https_proxy", "HTTPS_PROXY"];

// ログに認証情報が残らないよう、ユーザー名とパスワードを伏せる。
export function maskProxyUrl(proxyUrl) {
  try {
    const url = new URL(proxyUrl);
    if (!url.host) return "(解析できない値)";
    const auth = url.username || url.password ? "***@" : "";
    return `${url.protocol}//${auth}${url.host}`;
  } catch {
    return "(解析できない値)";
  }
}

// 起動時に表示する、プロキシの使用状況。
export function describeProxy(env) {
  if (env[USED_VARIABLE]) {
    return [`WebPush proxy: 使用する (${USED_VARIABLE}=${maskProxyUrl(env[USED_VARIABLE])})`];
  }

  const lines = [`WebPush proxy: 使用しない (${USED_VARIABLE} は未設定)`];
  const ignored = UNUSED_VARIABLES.filter((name) => env[name]);
  if (ignored.length > 0) {
    lines.push(
      `  注意: ${ignored.join(", ")} は設定されていますが使われません。プロキシを使うには ${USED_VARIABLE} を設定してください。`,
    );
  }
  return lines;
}
