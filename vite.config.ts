import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  plugins: [
    react(),
    {
      name: "remove-crossorigin",
      transformIndexHtml(html) {
        return html.replace(/crossorigin/g, "");
      },
    },
  ],
  server: {
    host: "127.0.0.1",
    port: 5173,
  },
});
