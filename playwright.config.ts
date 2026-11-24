import { defineConfig } from "@playwright/test";

const baseURL = (process.env.APP_URL || "http://localhost:3070").replace(/\/+$/, "");
const chromeExecutable = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || process.env.CHROME_PATH;

// The exporter (src/lib/exporters.ts) looks at CHROME_PATH first. Mirror the
// browser override used by Playwright so PDF/PPTX export tests use the same binary.
const env: Record<string, string> = {};
for (const [key, value] of Object.entries(process.env)) {
  if (value !== undefined) env[key] = value;
}
if (chromeExecutable) env.CHROME_PATH = chromeExecutable;

// Use an explicitly provided executable when present; otherwise prefer the
// installed Chrome channel. No bundled-browser download is required.
const browserOptions: { channel?: string; launchOptions?: { executablePath?: string } } =
  chromeExecutable ? { launchOptions: { executablePath: chromeExecutable } } : { channel: "chrome" };

export default defineConfig({
  testDir: "./tests",
  outputDir: "test-results",
  // Several scenarios mutate the single global /api/settings row and the shared
  // SQLite data directory. One worker keeps runs deterministic; override with
  // PLAYWRIGHT_WORKERS only when the server state is isolated per worker.
  workers: process.env.PLAYWRIGHT_WORKERS ? Number(process.env.PLAYWRIGHT_WORKERS) : 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL,
    ...browserOptions,
    viewport: { width: 1440, height: 900 },
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    actionTimeout: 15_000,
    navigationTimeout: 60_000,
  },
  webServer: {
    command: 'cmd /c "npm run dev"',
    port: 3070,
    reuseExistingServer: true,
    timeout: 120_000,
    env,
  },
});
