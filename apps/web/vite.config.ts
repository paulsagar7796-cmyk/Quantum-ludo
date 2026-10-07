import tailwindcss from "@tailwindcss/vite";
import basicSsl from "@vitejs/plugin-basic-ssl";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// HTTPS=1 serves over https with a self-signed certificate, so phones on the Wi-Fi get a
// secure page: browsers only allow the camera (for QR pairing) on secure pages.
const https = process.env.HTTPS === "1";

export default defineConfig({
  plugins: [
    ...(https ? [basicSsl()] : []),
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "Quantum Ludo",
        short_name: "Q-Ludo",
        description: "Classic Ludo with quantum mechanics: Split, Link, Ghost and Force.",
        theme_color: "#0b1020",
        background_color: "#0b1020",
        display: "standalone",
        orientation: "any",
        start_url: "/",
        icons: [
          { src: "pwa-192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512.png", sizes: "512x512", type: "image/png" },
          { src: "pwa-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
      },
    }),
  ],
  server: { host: true },
});
