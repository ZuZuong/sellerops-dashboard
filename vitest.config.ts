import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config.ts'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      include: ['src/**/*.test.{ts,tsx}'],
      setupFiles: ['./src/test/setup.ts'],
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
        exclude: ['src/**/*.test.{ts,tsx}', 'src/test/**', 'src/shared/types/**', 'src/main.tsx'],
      },
    },
  }),
)
