// @ts-check
const { defineConfig, devices } = require("@playwright/test");
const fs = require("fs");

const PORT = Number(process.env.E2E_PORT || 4173);
// Open-source Chromium cannot decode H.264/AAC. If a codec-complete Chrome is available (e.g. Chrome for Testing), the
// suite runs on it too; point E2E_CHROME_PATH at its binary. Tests feature-detect codecs and skip honestly when absent.
const puppeteerChromes = (() => {
  try {
    return fs.readdirSync("/home").map((u) => `/home/${u}/.cache/puppeteer/chrome`).filter((d) => fs.existsSync(d))
      .flatMap((d) => fs.readdirSync(d).map((v) => `${d}/${v}/chrome-linux64/chrome`));
  } catch { return []; }
})();
const chromePath = process.env.E2E_CHROME_PATH || [...puppeteerChromes, "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable"].find((p) => p && fs.existsSync(p));
const launch = { args: ["--autoplay-policy=no-user-gesture-required", "--no-sandbox"] };

module.exports = defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.js",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"], ["json", { outputFile: "test-results/e2e.json" }]],
  use: { baseURL: `http://127.0.0.1:${PORT}`, trace: "retain-on-failure" },
  webServer: { command: "node e2e/server.js", url: `http://127.0.0.1:${PORT}/movie-app/`, reuseExistingServer: !process.env.CI, timeout: 30_000 },
  projects: [
    { name: "chromium (open-source, no H.264)", use: { ...devices["Desktop Chrome"], launchOptions: launch } },
    ...(chromePath ? [{ name: "chrome (H.264/AAC)", use: { ...devices["Desktop Chrome"], launchOptions: { ...launch, executablePath: chromePath } } }] : []),
  ],
});
