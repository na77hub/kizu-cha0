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

//import ffmpeg from "fluent-ffmpeg";
//import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
//ffmpeg.setFfmpegPath(ffmpegInstaller.path);

//import { nodewhisper } from "nodejs-whisper";

import * as myConf from "./conf.js";

////////////////////
// ssl
////////////////////
const g_sslKey = fs.readFileSync(myConf.sslKeyFile).toString();
const g_sslCrt = fs.readFileSync(myConf.sslCrtFile).toString();

////////////////////
// directories
////////////////////
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
g_app.get(myConf.kcRootPath+":room/*splat", (req, res) => {
    const path = myConf.publicDir + req.params.splat.join("/");
    if (fs.existsSync(path)) {
        res.sendFile(path);
    } else {
        res.status(404).send("404 Not Found");
    }
});
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
const g_io = new SocketIO(g_webSrv);
//
g_io.use((socket, next) => {
    const query = socket.handshake.query;

    // authentication
    
    return next();
});
g_io.on("connection", (socket) => {
    const query = socket.handshake.query;
    
    // uuid check
    if (!"uuid" in query) {
        socket.disconnect("query.uuid is not found");
    }
    // room check
    if (!"room" in query) {
        socket.disconnect("query.room is not found");
        return;
    }

    // valuables
    socket.uuid = query.uuid;
    socket.room = query.room;
    socket.join(socket.room);

    // event
    socket.on("video-upload", (data) => {
        const timestamp = Date.now();
        const filename = "video-" + timestamp + ".webm";
        const filenameMp4 = "video-" + timestamp + ".mp4";
        //const dirpath = myConf.roomVideoDir + socket.room + "/";
        const dirpath = myConf.roomDataDir + socket.room + "/video/";
        const filepath = dirpath + filename;
        const filepathMp4 = dirpath + filenameMp4;
        
        if (!fs.existsSync(dirpath)) {
            fs.mkdirSync(dirpath, { recursive: true });
        }
        
        fs.writeFile(filepath, Buffer.from(data), (err) => {
            if (err) {
                //console.error("Video 保存失敗:", err);
                socket.emit("video-upload-result", {
                    success: false
                });
            } else {
                //console.log("Video 保存完了:", filepath);
                convertWebmToMp4(filepath, filepathMp4).then(() => {
                    // ここで認識させる
                    const sampleTexts = [
                        "スマホを顔認証で開こうとしたら、真顔だと認識されませんでした。",
                        "「明日から本気出す」が、私の得意なスポーツです。",
                        "ダイエットは明日からと言い続けたら、もう半年が過ぎました。",
                        "靴下を脱いだら、床に私の足跡が残っていました。",
                        "寝坊して会社に遅刻しそうになったら、なぜか道で猫に懐かれました。",
                        "冷蔵庫を開けたら、目的を忘れるのはもはや才能だと思います。",
                        "お気に入りの服を着て外出したら、知らない人とおそろいでした。",
                        "家の中で鍵を探していたら、ポケットから見つかりました。",
                        "全力で走ったのに、電車に乗り遅れるという奇跡を起こしました。",
                        "今日は早く寝ようと決めたのに、YouTubeが私の睡眠を妨害します。"
                    ];
                    const recogResult = {
                        text: sampleTexts[Math.floor(Math.random()*sampleTexts.length)]
                    };
                    
                    //socket.emit("video-upload-result", {
                    g_io.sockets.in(socket.room).emit("video-upload-result", {
                        success: true,
                        filename: filename,
                        recogResult: recogResult,
                        timestamp: timestamp
                    });
                    
                });
            }
        });
    });
    socket.on("audio-upload", (data) => {
        const timestamp = Date.now();
        const filename = "audio-" + timestamp + ".wav";
        const dirpath = myConf.roomDataDir + socket.room + "/audio/";
        const filepath = dirpath + filename;
        
        if (!fs.existsSync(dirpath)) {
            fs.mkdirSync(dirpath, { recursive: true });
        }
        
        fs.writeFile(filepath, Buffer.from(data), (err) => {
            if (err) {
                console.error("Audio 保存失敗:", err);
                socket.emit("audio-upload-result", {
                    success: false
                });
            } else {
                console.log("Audio 保存完了:", filepath);

                transcribeWithWhisper(filepath).then((text) => {
                    const recogResult = {
                        text: text
                    };
                    g_io.sockets.in(socket.room).emit("audio-upload-result", {
                        success: !(text === undefined),
                        filename: filename,
                        recogResult: recogResult,
                        timestamp: timestamp
                    });
                });
            }
        });

    });
    
/*
    //const outputFile = path.join("uploads", `video-${Date.now()}.webm`);
    const outputFile = "video-"+Date.now()+".webm";
    const writeStream = fs.createWriteStream(outputFile);
    
    socket.on("video-chunk", (chunk) => {
        // chunk は ArrayBuffer（Uint8Arrayに変換して書き込み）
        writeStream.write(Buffer.from(chunk));
    });
    
    socket.on("end-recording", () => {
        writeStream.end();
        console.log("録画終了:", outputFile);
        
        // 必要に応じて ffmpeg で mp4 に変換
        // 例: ffmpeg -i input.webm -c copy output.mp4
    });
  */  

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

