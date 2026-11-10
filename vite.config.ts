import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // plugin-react bật sẵn HMR + React Fast Refresh: lưu file là UI cập nhật, giữ nguyên state.
  plugins: [react()],
  server: {
    // Tự mở trình duyệt khi chạy `npm run dev`.
    open: true,
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
