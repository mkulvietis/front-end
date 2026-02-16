import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'

export default defineConfig({
  plugins: [solid()],
  server: {
    // Disable HMR WebSocket — it can't work through the reverse proxy
    // and causes noisy console errors when accessed via ngrok
    hmr: false,
  },
})
