// server/config.js
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const appRootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

dotenv.config({ path: path.join(appRootDir, ".env"), quiet: true });

const sslDir = path.join(appRootDir, "ssl_cert");

export const config = {
  protocol: process.env.PROTOCOL ?? "http", // "http" or "https"
  port: Number(process.env.PORT ?? 50091),
  siteBasePath: "/",
  roomBasePath: "/kc/",
  proxyUrl: process.env.http_proxy,
  vapid: {
    subject: process.env.VAPID_SUBJECT,
    publicKey: process.env.VAPID_PUBLIC_KEY,
    privateKey: process.env.VAPID_PRIVATE_KEY,
  },
  dirs: {
    site: path.join(appRootDir, "root"),
    client: path.join(appRootDir, "public"),
    image: path.join(appRootDir, "image"),
    database: path.join(appRootDir, "database"),
  },
  files: {
    favicon: path.join(appRootDir, "image", "favicon-192x192.png"),
    sslKey: path.join(sslDir, "server.key"),
    sslCert: path.join(sslDir, "server.crt"),
    accessQrCode: path.join(appRootDir, "root", "2Dcode.png"),
  },
};
