import { defineConfig } from "vite";

// Кастомный домен раздаётся с корня (antawkay.com), поэтому base '/'.
// index.html в корне — точка входа; public/ копируется в dist/ as-is.
export default defineConfig({
  base: "/",
});
