// server/index.js
import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import qrcode from "qrcode";
import { config } from "./config.js";
import { createMessageStore } from "./messages.js";
import { getLocalIpAddresses } from "./network.js";
import { createPreferenceStore } from "./preferences.js";
import { describeProxy } from "./proxy.js";
import { createPushService } from "./push.js";
import { createRateLimiter } from "./rate-limiter.js";
import { createApp } from "./routes.js";
import { attachSocketServer } from "./socket.js";
import { createSubscriptionStore } from "./subscriptions.js";

fs.mkdirSync(config.dirs.database, { recursive: true });

const subscriptionStore = createSubscriptionStore(config.dirs.database);
const messageStore = createMessageStore({ directory: config.dirs.database });
const preferenceStore = createPreferenceStore({ directory: config.dirs.database });
const rateLimiter = createRateLimiter({ limit: 5, windowMs: 10_000 });
const pushService = createPushService({
  vapid: config.vapid,
  proxyUrl: config.proxyUrl,
  subscriptionStore,
  preferenceStore,
});

const app = createApp(config);
const httpServer =
  config.protocol === "https"
    ? https.createServer(
        {
          key: fs.readFileSync(config.files.sslKey),
          cert: fs.readFileSync(config.files.sslCert),
        },
        app,
      )
    : http.createServer(app);

attachSocketServer(httpServer, {
  subscriptionStore,
  messageStore,
  pushService,
  preferenceStore,
  rateLimiter,
});

httpServer.listen(config.port, () => {
  console.log("kizu-cha server has started");
  describeProxy(process.env).forEach((line) => console.log(line));
  const urls = getLocalIpAddresses().map(({ name, address }) => ({
    name,
    url: `${config.protocol}://${address}:${config.port}/`,
  }));
  urls.forEach(({ name, url }) => console.log(`${name}:`, url));

  if (urls.length > 0) {
    qrcode.toFile(config.files.accessQrCode, urls[0].url, { width: 256 }, (error) => {
      if (error) throw error;
      console.log("Saved the 2D code:", config.files.accessQrCode);
    });
  }
});
