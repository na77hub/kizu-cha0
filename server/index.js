// server/index.js
import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import qrcode from "qrcode";
import { config } from "./config.js";
import { getLocalIpAddresses } from "./network.js";
import { createPushService } from "./push.js";
import { createApp } from "./routes.js";
import { attachSocketServer } from "./socket.js";
import { createSubscriptionStore } from "./subscriptions.js";

fs.mkdirSync(config.dirs.database, { recursive: true });

const subscriptionStore = createSubscriptionStore(config.dirs.database);
const pushService = createPushService({
  vapid: config.vapid,
  proxyUrl: config.proxyUrl,
  subscriptionStore,
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

attachSocketServer(httpServer, { subscriptionStore, pushService });

httpServer.listen(config.port, () => {
  console.log("kizu-cha server has started");
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
