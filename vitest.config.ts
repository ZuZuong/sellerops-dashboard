import { fileURLToPath } from 'node:url'
import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config.ts'

export default mergeConfig(
  viteConfig,
  defineConfig({
    resolve: {
      // Tiện ích test (render, fixtures) nằm ngoài src: testcase/support.
      alias: { '@test': fileURLToPath(new URL('./testcase/support', import.meta.url)) },
    },
    test: {
      environment: 'jsdom',
      // Toàn bộ test nằm trong testcase/ (xem testcase/FLOW-TEST.md).
      include: ['testcase/**/*.test.{ts,tsx}'],
      setupFiles: ['./testcase/support/setup.ts'],
      restoreMocks: true,
      // Test tương tác (userEvent.type gõ từng ký tự vào form dài) chạy song song trên CI / máy
      // đang tải nặng có thể vượt 5s mặc định dù chạy riêng chỉ ~2s.
      testTimeout: 15_000,
      // Giá trị giả để env.ts không chặn khi import; test không gọi mạng thật.
      env: {
        VITE_SUPABASE_URL: 'http://localhost:54321',
        VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
      },
      coverage: {
        provider: 'v8',
        include: ['src/**/*.{ts,tsx}'],
        exclude: ['src/shared/types/**', 'src/main.tsx'],
      },
    },
  }),
)
