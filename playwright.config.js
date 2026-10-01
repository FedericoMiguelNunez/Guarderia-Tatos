import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests', testMatch: '**/*.spec.js', timeout: 30_000,
  use: { baseURL: 'http://127.0.0.1:8888', screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  webServer: { command: process.platform === 'win32' ? 'npm.cmd run dev' : 'npm run dev', url: 'http://127.0.0.1:8888', reuseExistingServer: true, timeout: 120_000 },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } } },
    { name: 'mobile-390', use: { ...devices['Pixel 5'], viewport: { width: 390, height: 844 } } },
    { name: 'mobile-360', use: { ...devices['Galaxy S9+'], viewport: { width: 360, height: 740 } } }
  ]
});
