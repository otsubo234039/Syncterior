import { defineConfig } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';

// A second invocation must not clear traces belonging to an active run.
const lock = new URL('./.playwright-run.lock', import.meta.url);
if (existsSync(lock) && readFileSync(lock, 'utf8') !== process.env.SYNCTERIOR_E2E_OWNER) {
  throw new Error('E2Eが実行中です。終了してから再実行してください。');
}

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.js',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  // Software WebGL is CPU-intensive; avoid four simultaneous 3D contexts.
  workers: 1,
  timeout: 60_000,
  globalTimeout: 15 * 60_000,
  // Initial shader compilation can block UI updates with software WebGL.
  expect: { timeout: 30_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    sceneMode: 'ui',
    browserName: 'chromium',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
  },
  projects: [
    { name: 'desktop', testIgnore: ['**/*.desktop.spec.js', '**/*.3d.spec.js'],
      use: { viewport: { width: 1440, height: 1000 }, sceneMode: 'ui' } },
    { name: 'mobile', testIgnore: ['**/*.desktop.spec.js', '**/*.3d.spec.js'],
      use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, sceneMode: 'ui' } },
    { name: '3d', testMatch: ['**/*.desktop.spec.js', '**/*.3d.spec.js'], workers: 1,
      dependencies: ['desktop', 'mobile'],
      use: { viewport: { width: 1440, height: 1000 }, sceneMode: 'full' } },
  ],
  webServer: [
    { command: 'node e2e/fixtures/room-api-server.js', url: 'http://127.0.0.1:4175/health', reuseExistingServer: false, timeout: 120_000 },
    { command: 'npm run preview -- --config e2e/vite.config.js --outDir dist-e2e/app --host 127.0.0.1 --port 4173 --strictPort',
      url: 'http://127.0.0.1:4173', reuseExistingServer: false, timeout: 120_000 },
    { command: 'npm run preview -- --outDir dist-e2e/app --host 127.0.0.1 --port 4174 --strictPort',
      url: 'http://127.0.0.1:4174', reuseExistingServer: false, timeout: 120_000 },
  ],
});
