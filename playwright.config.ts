import { defineConfig, devices } from '@playwright/test'

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000'
const isCI = !!process.env.CI

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: 1,
  reporter: isCI ? [['list'], ['html', { open: 'never' }]] : 'html',
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: [/mobile\.spec\.ts/],
    },
    {
      // Solo Chromium emulado (no WebKit) para CI con `playwright install chromium`.
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
      // Solo a11y.spec.ts (no bulk-a11y.spec.ts) y mobile.spec.ts
      testMatch: [/mobile\.spec\.ts$/, /(?:^|[/\\])a11y\.spec\.ts$/],
    },
  ],
  webServer: process.env.PLAYWRIGHT_SKIP_WEBSERVER
    ? undefined
    : {
        // CI: next start (requiere build previo en workflow). Nunca omite el servidor.
        // Local: next dev. reuseExistingServer solo con PLAYWRIGHT_REUSE=1 explícito.
        command: isCI ? 'npm run start' : 'npm run dev',
        url: baseURL,
        reuseExistingServer: process.env.PLAYWRIGHT_REUSE === '1',
        timeout: 180000,
        env: {
          ...process.env,
          PLAYWRIGHT_TEST: '1',
          // Prioridad E2E_* para no heredar .env.local de producción en el webServer
          NEXT_PUBLIC_SUPABASE_URL:
            process.env.E2E_SUPABASE_URL ||
            process.env.NEXT_PUBLIC_SUPABASE_URL ||
            'http://127.0.0.1:54321',
          NEXT_PUBLIC_SUPABASE_ANON_KEY:
            process.env.E2E_ANON_KEY ||
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder',
          ORDER_ACCESS_SECRET:
            process.env.ORDER_ACCESS_SECRET || 'e2e-order-access-secret-32',
          CRON_SECRET: process.env.CRON_SECRET || 'e2e-cron-secret-32chars',
        },
      },
  timeout: 60000,
  expect: { timeout: 15000 },
})
