// conf.js

import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// application root
export const kcRootDir = __dirname +  "/";

// server settings
export const protcol = "https"; // "http" or "https"
export const port = 50090;
export const webRootPath = "/";
export const kcRootPath = "/kc/";

// directory settings
//export const nodeModulesDir = kcRootDir + "node_modules/";
export const publicDir = kcRootDir + "public/";
//export const libDir = kcRootDir + "lib/";
export const imageDir = kcRootDir + "image/";
export const sslDir = kcRootDir + "ssl_cert/";
export const rootDir = kcRootDir + "root/";
export const roomDataDir = kcRootDir + "room_data/";
//export const roomLogDir = kcRootDir + "room_data/log/";
//export const roomVideoDir = kcRootDir + "room_data/video/";
//export const roomAudioDir = kcRootDir + "room_data/audio/";

// files
export const faviconFile = imageDir + "favicon-1024x1024.png";
export const sslKeyFile = sslDir + "server.key";
export const sslCrtFile = sslDir + "server.crt";

// whisper
//export const wisperModelName = "base";
//export const whisperModelName = "small";
//export const whisperPath = "./whisper.cpp/build/bin";
