// server/network.js
import os from "node:os";

// ループバック以外の IPv4 アドレスを列挙する。
export function getLocalIpAddresses() {
  return Object.entries(os.networkInterfaces()).flatMap(([name, interfaces]) =>
    interfaces
      .filter((entry) => entry.family === "IPv4" && !entry.internal)
      .map((entry) => ({ name, address: entry.address })),
  );
}
