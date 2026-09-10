import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Se sirve bajo /output, por eso base "/output/".
export default defineConfig({
  base: "/output/",
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      "/api": "http://localhost:4000",
      "/socket.io": { target: "http://localhost:4000", ws: true },
    },
  },
});
