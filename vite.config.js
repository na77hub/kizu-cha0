import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
    root: 'src', // 開発ディレクトリ
    envDir: path.resolve(__dirname), // .env のあるディレクトリ
    base: './',
    build: {
        outDir: '../public', // ビルド成果物の出力先
        emptyOutDir: true,
        rollupOptions: {
            input: {
                main: path.resolve(__dirname, 'src/index.html'),
            },
        },
    },
    server: {
        port: 5173, // 開発時用（app.jsとは別ポート）
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
});
