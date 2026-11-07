// server/routes.js
import compression from "compression";
import express from "express";
import serveFavicon from "serve-favicon";
import { isValidRoomId } from "./validators.js";

function createWebManifest(roomId) {
  return {
    name: `kizu-cha(${roomId})`,
    short_name: `kc(${roomId})`,
    start_url: "./index.html",
    scope: "./",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#000000",
    icons: [{ src: "/image/favicon-192x192.png", sizes: "192x192", type: "image/png" }],
  };
}

export function createApp(config) {
  const app = express();
  const roomPath = `${config.roomBasePath}:roomId`;

  app.use(compression());
  app.use(serveFavicon(config.files.favicon));
  app.use(config.siteBasePath, express.static(config.dirs.site));
  app.use(`${config.siteBasePath}image/`, express.static(config.dirs.image));

  app.use(roomPath, (req, res, next) => {
    if (!isValidRoomId(req.params.roomId)) {
      return res.status(400).send("400 Bad Request");
    }
    return next();
  });
  app.get(roomPath, (req, res) => {
    res.sendFile("index.html", { root: config.dirs.client });
  });
  app.get(`${roomPath}/manifest.webmanifest`, (req, res) => {
    res.type("application/manifest+json").json(createWebManifest(req.params.roomId));
  });
  app.use(roomPath, express.static(config.dirs.client));

  return app;
}
