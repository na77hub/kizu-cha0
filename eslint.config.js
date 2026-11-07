import js from "@eslint/js";
import globals from "globals";

export default [
  { ignores: ["node_modules/", "public/", "root/"] },
  js.configs.recommended,
  { files: ["server/**", "test/**", "*.js"], languageOptions: { globals: globals.node } },
  { files: ["src/**"], languageOptions: { globals: globals.browser } },
  { files: ["src/service-worker.js"], languageOptions: { globals: globals.serviceworker } },
];
