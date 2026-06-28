import { defineConfig, devices } from '@playwright/test';

const launchArgs: string[] = [];
if (process.env.CI) {
  launchArgs.push('--use-gl=swiftshader');
}

const runHeadedLocally = !process.env.CI && process.env.PW_HEADLESS !== '1';

export default defineConfig({
  testMatch: 'e2e/specs/**/*.spec.ts',
  timeout: 60 * 1000,
  retries: process.env.CI ? 2 : 1,

  use: {
    baseURL: 'http://127.0.0.1:5174',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        headless: !runHeadedLocally,
        launchOptions: {
          args: launchArgs,
        },
      },
    },
    {
      name: 'render-baseline',
      testMatch: 'e2e/specs/render-baseline.spec.ts',
      workers: 1,
      use: {
        ...devices['Desktop Chrome'],
        headless: !runHeadedLocally,
        ...(process.env.BROWSER_EXE ? { executablePath: process.env.BROWSER_EXE } : {}),
        launchOptions: {
          args: launchArgs,
        },
      },
    },
  ],

  webServer: {
    command: 'npm run preview -- --host 127.0.0.1 --port 5174',
    url: 'http://127.0.0.1:5174',
    reuseExistingServer: true,
  },
});
