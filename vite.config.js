import { defineConfig } from 'vite';
import { viteStaticCopy } from "vite-plugin-static-copy";
import path from 'path';

export default defineConfig({
    root: "src", // 開発ディレクトリ
    envDir: path.resolve(__dirname), // .env のあるディレクトリ
    base: "./",
    build: {
        outDir: "../public", // ビルド成果物の出力先
        emptyOutDir: true,
        rollupOptions: {
            input: {
                main: path.resolve(__dirname, "src/index.html"),
            },
        },
    },
    plugins: [
        viteStaticCopy({
            targets: [
                {
                    src: path.resolve(__dirname, "src/sw_kizu-cha.js"),
                    dest: "."
                    //dest: path.resolve(__dirname, "root")
                }
            ]
        })
    ],
    server: {
        port: 5173, // 開発時用（app.jsとは別ポート）
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, "./src"),
        },
    },
});
