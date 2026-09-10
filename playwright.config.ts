import { defineConfig, devices } from '@playwright/test'

/** E2E: собранное приложение через vite preview. Главная проверка — офлайн-режим. */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: 'http://localhost:4173',
    ...devices['Pixel 5'],
  },
  webServer: {
    command: 'npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
})
