// app.js

////////////////////
// load modules
////////////////////
import fs from "fs";
import express from "express";
import compression from "compression";
import serveFavicon from "serve-favicon";
import http from "http";
import https from "https";
import { Server as SocketIO } from "socket.io";
import os from "os";
import qrcode from "qrcode";
import nedb from "@seald-io/nedb";
import { default as webpush } from 'web-push';
import dotenv from "dotenv";

import path from "path";
import { fileURLToPath } from "url";

// generate __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


//import ffmpeg from "fluent-ffmpeg";
//import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
//ffmpeg.setFfmpegPath(ffmpegInstaller.path);

//import { nodewhisper } from "nodejs-whisper";

import * as myConf from "./conf.js";

dotenv.config({
    path: path.resolve(__dirname, ".env"),
    quiet: true
});
// dotenvからキーが読み込まれたかテスト
// console.log( `VAPID_PUBLIC_KEY=${process.env.VAPID_PUBLIC_KEY}` );
// console.log( `VAPID_PRIVATE_KEY=${process.env.VAPID_PRIVATE_KEY}` );

// web-push
webpush.setVapidDetails(
    process.env.VAPID_SUBJECT,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
);

// proxy
const g_proxyServer = process.env.http_proxy;

////////////////////
// ssl
////////////////////
const g_sslKey = fs.readFileSync(myConf.sslKeyFile).toString();
const g_sslCrt = fs.readFileSync(myConf.sslCrtFile).toString();

////////////////////
// directories
////////////////////
if (!fs.existsSync(myConf.databaseDir)) {
    fs.mkdirSync(myConf.databaseDir, { recursive: true });
}
if (!fs.existsSync(myConf.roomDataDir)) {
    fs.mkdirSync(myConf.roomDataDir, { recursive: true });
}
/*
if (!fs.existsSync(myConf.roomLogDir)) {
    fs.mkdirSync(myConf.roomLogDir, { recursive: true });
}
if (!fs.existsSync(myConf.roomVideoDir)) {
    fs.mkdirSync(myConf.roomVideoDir, { recursive: true });
}
if (!fs.existsSync(myConf.roomAudioDir)) {
    fs.mkdirSync(myConf.roomAudioDir, { recursive: true });
}
*/

////////////////////
// nedb
////////////////////
//const g_subscriptionDB = new nedb({ filename: "subscriptionDB", autoload: true });
const g_subscriptionDB = new nedb({ filename: myConf.databaseDir+"subscriptionDB.db", autoload: true });

////////////////////
// IP address
////////////////////
function getLocalIPs() {
  const interfaces = os.networkInterfaces();
  const addresses = [];

  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // IPv4 かつ ローカルループバック以外
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push({
          name,
          address: iface.address
        });
      }
    }
  }
  return addresses;
}

////////////////////
// web server
////////////////////
const g_app = express();
//
g_app.use(compression());
g_app.use(serveFavicon(myConf.faviconFile));
// for root path
g_app.use(myConf.webRootPath, express.static(myConf.rootDir));
g_app.use(myConf.webRootPath+"image/", express.static(myConf.imageDir));
// for standard room
g_app.use(myConf.kcRootPath+":room", (req, res, next) => {
    // check format
    if (!checkPathDirNameFormat(req.params.room)) {
        return res.status(500).send("500 Internal Server Error");
    }
    return next();
});
function checkPathDirNameFormat(name) {
    if (name === null || name === undefined || name === '') return false;
    if (/[\\\/:\*\?\"<>\|\.]/.test(name)) return false;
    return true;
}
// get files
g_app.get(myConf.kcRootPath+":room", (req, res) => {
    res.sendFile(myConf.publicDir + "index.html");
});
g_app.get(myConf.kcRootPath+":room/lib/*splat", (req, res) => {
    const path = myConf.libDir + req.params.splat.join("/");
    if (fs.existsSync(path)) {
        res.sendFile(path);
    } else {
        res.status(404).send("404 Not Found");
    }
});
g_app.get(myConf.kcRootPath+":room/icon/*splat", (req, res) => {
    const path = myConf.iconDir + req.params.splat.join("/");
    if (fs.existsSync(path)) {
        res.sendFile(path);
    } else {
        res.status(404).send("404 Not Found");
    }
});
/*
g_app.get(myConf.kcRootPath+":room/video/*splat", (req, res) => {
    const path = myConf.roomDataDir + req.params.room + "/video/" + req.params.splat.join("/");
    if (fs.existsSync(path)) {
        res.sendFile(path);
    } else {
        res.status(404).send("404 Not Found");
    }
});
g_app.get(myConf.kcRootPath+":room/audio/*splat", (req, res) => {
    const path = myConf.roomDataDir + req.params.room + "/audio/" + req.params.splat.join("/");
    if (fs.existsSync(path)) {
        res.sendFile(path);
    } else {
        res.status(404).send("404 Not Found");
    }
  });
*/
g_app.get(myConf.kcRootPath+":room/manifest.webmanifest", (req, res) => {
    const room = req.params.room;
    const manifest = createWebManifest(room);
    res.setHeader('Content-Type', 'application/manifest+json');
    res.json(manifest);    
});
g_app.get(myConf.kcRootPath+":room/*splat", (req, res) => {
    const path = myConf.publicDir + req.params.splat.join("/");
    if (fs.existsSync(path)) {
        res.sendFile(path);
    } else {
        res.status(404).send("404 Not Found");
    }
});
function createWebManifest(room) {
    return {
        "name": `kizu-cha(${room})`,
        "short_name": `kc(${room})`,
        "start_url": "./index.html",
        "scope": "./",
        "display": "standalone",
        "background_color": "#ffffff",
        "theme_color": "#000000",
        "icons": [
            {
                "src": "/image/favicon-192x192.png",
                "sizes": "192x192",
                "type": "image/png"
            }
        ]
    };    
}

// start web server
const g_webSrv = (myConf.protcol === "https") ?
      https.createServer({key:g_sslKey, cert:g_sslCrt}, g_app) :
      http.createServer(g_app);

g_webSrv.listen(myConf.port, () => {
    console.log("kizu-cha server has started");
    // urls
    const IPs = getLocalIPs();
    for (let i=0; i<IPs.length; i+=1) {
        //IPs[i]["url"] = (myConf.bHttps ? "https://" : "http://") + IPs[i].address + ":" + myConf.port + "/";
        IPs[i]["url"] = (myConf.protcol + "://") + IPs[i].address + ":" + myConf.port + "/";
        console.log( IPs[i].name + ":", IPs[i].url);
    }
    // 2D code
    const pathTo2DCode = myConf.rootDir+"2Dcode.png";
    if (IPs.length > 0) {
        qrcode.toFile(pathTo2DCode, IPs[0].url, {
            color: {
                dark: '#000000',
                light: '#FFFFFF'
            },
            width: 256
        }, (err) => {
            if (err) throw err;
            console.log("Saved the 2D code:", pathTo2DCode);
        });
    }

});

////////////////////
// socket.io server
////////////////////
const MAX_MESSAGE_LENGTH = 200;
function isValidSubscription(sub) {
    return !!sub
        && typeof sub.endpoint === "string"
        && typeof sub.keys?.p256dh === "string"
        && typeof sub.keys?.auth === "string";
}
const g_io = new SocketIO(g_webSrv);
//
g_io.use((socket, next) => {
    const query = socket.handshake.query;

    // authentication
    
    return next();
});
g_io.on("connection", (socket) => {
    const query = socket.handshake.query;
    
    // query check
    if (!query.uuid || !checkPathDirNameFormat(query.room)) {
        socket.disconnect(true);
        return;
    }

    // valuables
    socket.uuid = query.uuid;
    socket.room = query.room;
    socket.join(socket.room);

    // event
    socket.on("subscription for web push", (data) => {
        const subscription = data?.subscription;
        if (!isValidSubscription(subscription)) {
            console.warn("Invalid subscription from:", socket.uuid);
            return;
        }
        // room は接続時の値を使う（クライアント申告の data.room は信用しない）
        const query = {
            "subscription.endpoint": subscription.endpoint,
            "room": socket.room
        };

        g_subscriptionDB.count(query, (err, count) => {
            if (err) {
                console.error("Subscription DB count error:", err);
                return;
            }

            if (count > 0) {
                console.log("Subscription already exists for this room and endpoint. Skip insert.");
            } else {
                g_subscriptionDB.insert({ subscription, room: socket.room }, (err, newDoc) => {
                    if (err) {
                        console.error("Subscription DB insert error:", err);
                    } else {
                        console.log("Subscription DB insert success:", newDoc);
                    }
                });
            }
        });
    });


    socket.on("unsubscription from web push", (data) => {
        const endpoint = data?.subscription?.endpoint;
        if (typeof endpoint !== "string") {
            console.warn("Invalid unsubscription from:", socket.uuid);
            return;
        }
        const query = {
            "subscription.endpoint": endpoint,
            "room": socket.room
        };

        g_subscriptionDB.remove(query, {}, (err, numRemoved) => {
            if (err) {
                console.error("Subscription DB remove error:", err);
                return;
            }

            if (numRemoved > 0) {
                console.log("Subscription DB remove success. Rows removed:", numRemoved);
            } else {
                console.log("No matching subscription found to remove.");
            }
        });
    });

    socket.on("send web push to room", (data) => {
        // 形式：data = { message: "こんにちは！" }（送信先は接続時の room）
        const message = data?.message;
        if (typeof message !== "string" || message.length === 0 || message.length > MAX_MESSAGE_LENGTH) {
            console.warn("Invalid message from:", socket.uuid);
            return;
        }

        const room = socket.room;
        g_subscriptionDB.find({ room }, (err, docs) => {
            if (err) {
                console.error("Subscription DB find error:", err);
                return;
            }

            if (docs.length === 0) {
                console.log(`No subscriptions found for room: ${room}`);
                return;
            }

            console.log(`Sending WebPush to ${docs.length} devices in room: ${room}`);

            const payload = JSON.stringify({
                title: "新着通知",
                body: message,
                url: `${myConf.kcRootPath}${room}/`
            });

            let options = {};
            if (g_proxyServer) {
                options["proxy"] = g_proxyServer;
            }
            docs.forEach((doc) => {
                webpush.sendNotification(doc.subscription, payload, options)
                    .then(() => {
                        console.log("WebPush sent successfully to:", doc._id);
                    })
                    .catch((pushErr) => {
                        console.error("WebPush send error for:", doc._id, pushErr);
                        if (pushErr.statusCode === 404 || pushErr.statusCode === 410) {
                            g_subscriptionDB.remove({ _id: doc._id }, {}, () => {
                                console.log("Removed expired subscription from DB:", doc._id);
                            });
                        }
                    });
            });
        });
    });

    socket.on("disconnect", () => {
        //console.log("disconnected");
    });    

    socket.emit("connected");
});

////////////////////
// ffmpeg converter
////////////////////
function convertWebmToMp4(inputPath, outputPath) {
    return new Promise((resolve, reject) => {
        ffmpeg(inputPath)
            .videoCodec('libx264') // 映像コーデック指定
            .noAudio()              // 音声なし
            .save(outputPath)
            .on('end', () => {
                console.log('✅ 変換完了:', outputPath);
                resolve();
            })
            .on('error', (err) => {
                console.error(err);
                reject(err);
            });
    });
}

////////////////////
// nodejs-whisper
////////////////////
async function transcribeWithWhisper(audioFilePath) {
    let result;
    try {
        result = await nodewhisper(audioFilePath, {
            modelName: myConf.whisperModelName,
            autoDownloadModelName: myConf.whisperModelName,
            removeWavFileAfterTranscription: false,
            whisperOptions: {
                language: "ja",
                outputInText: false,
                //outputInSrt: true,
                outputInSrt: false,
                translateToEnglish: false,
                //wordTimestamps: true,
                wordTimestamps: false,
                splitOnWord: true
            }
        });
    } catch(error) {
        console.error("[Whisper] エラー発生:", error.message);
    }
    return result;
}

