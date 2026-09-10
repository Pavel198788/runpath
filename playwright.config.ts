import { defineConfig, devices } from '@playwright/test'

/** E2E: собранное приложение через vite preview. Главная проверка — офлайн-режим. */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: 'http://localhost:4183',
    ...devices['Pixel 5'],
    // На macOS 13 браузеры Playwright не ставятся — используем системный Chrome.
    ...(process.env.USE_SYSTEM_CHROME ? { channel: 'chrome' } : {}),
  },
  webServer: {
    // Свой порт и всегда свежий сервер: на 4173 может висеть другой проект.
    command: 'npx vite preview --port 4183 --strictPort',
    url: 'http://localhost:4183',
    reuseExistingServer: false,
    timeout: 60_000,
  },
})
