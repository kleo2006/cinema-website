# Production audit

Findings from inspecting the repository before changes, with the baseline measured on the untouched source.

## Baseline

| Check | Result |
|---|---|
| `npm run lint` | Pass |
| `npm run test:ci` | 54 passed, **23 failed** (`playbackHardening`, `libraryStates`) |
| `npm run build` | Pass |
| `npm audit` | 106 vulnerabilities (3 critical, 80 high, 18 moderate, 5 low) |
| Playwright suite | **Every test failed** (see defect 2) |

## What already worked (preserved unchanged)

Catalogue and resolver architecture, HLS via hls.js with native-HLS fallback, the player and its progress persistence, watchlist and continue-watching, routing with the GitHub Pages `404.html` fallback, the e2e fixtures (generated test film, HLS, subtitles) and the e2e server.

## Defects found

1. **Tests specified an API the source did not implement.** `parseCatalog`, `CatalogError`, resolver timeout, failure reasons, config validation, `probeSourceStatus`, codec-aware source choice and a Library error state were tested but missing.
2. **`scripts/postbuild.js` ignored `BUILD_PATH`.** The e2e build never received `404.html`, so every deep link returned "Not found" and the whole browser suite failed.
3. **`package.json` lacked scripts the repo's own files document:** `prebuild` (secret guard), `test:e2e`; `@playwright/test` was installed but undeclared (`npm ls` reported it extraneous).
4. **URL check let `/\host` through.** Browsers read it as `//host`, so a "same-origin" source could point at another origin. Credentials in URLs were also accepted.
5. **A failed catalogue load was indistinguishable from an empty catalogue**, and a malformed resolver answer could fall through to "trailer only".
6. **The metadata client could send the API key to a malformed `REACT_APP_TMDB_BASE_URL`**, and a relative proxy path threw.
7. **A 403 on a progressive source showed a generic failure** instead of "link expired".

## Not changed, with reason

- **Dependency vulnerabilities.** Criticals are `proxy-addr`, `shell-quote`, `websocket-driver`: the dev-server/build toolchain pulled in by `react-scripts`, not shipped to browsers. `react-router-dom` 6.30.6 (moderate) does ship; the fix is a major upgrade to v7, which was not made without a verified reason. Leaving `react-scripts` is a separate migration.
- **Design, routes, catalogue content.** `public/catalog.json` is intentionally empty: no authorized film is configured, and none was invented.
