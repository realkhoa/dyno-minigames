import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Relative base keeps the build portable: it works at
// https://<user>.github.io/<repo>/ without hard-coding the repo name.
export default defineConfig({
  base: "./",
  plugins: [react()],
});
