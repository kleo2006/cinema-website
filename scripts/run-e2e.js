/**
 * Builds the app for the browser tests (into build-e2e/, with the TMDB stub as metadata host) and runs Playwright.
 *   npm run test:e2e                 build if needed, run the suite
 *   npm run test:e2e -- --rebuild    force a rebuild first
 *   E2E_FULL=1 npm run test:e2e      also play the whole 180 s film in real time
 */
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const args = process.argv.slice(2);
const port = process.env.E2E_PORT || "4173";
const dir = path.join(root, "build-e2e");
const run = (cmd, a, env = {}) => {
  const r = spawnSync(cmd, a, { cwd: root, stdio: "inherit", env: { ...process.env, ...env }, shell: process.platform === "win32" });
  if (r.status !== 0) process.exit(r.status || 1);
};

if (args.includes("--rebuild") || args.includes("--build-only") || !fs.existsSync(path.join(dir, "index.html"))) {
  run("npm", ["run", "build"], { BUILD_PATH: "build-e2e", REACT_APP_TMDB_BASE_URL: `http://127.0.0.1:${port}/tmdb`, REACT_APP_PLAYBACK_CATALOG_URL: "", REACT_APP_PLAYBACK_RESOLVER_URL: "", REACT_APP_API_KEY: "" });
}
if (!args.includes("--build-only")) run("npx", ["playwright", "test", ...args.filter((a) => a !== "--rebuild")]);
