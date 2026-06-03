import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    // Proxy ke OpenWA gateway agar browser tidak kena CORS.
    // Ubah target jika OpenWA berjalan di host/port lain.
    proxy: {
      '/api': {
        target: 'http://localhost:2785',
        changeOrigin: true,
      },
    },
  },
})
