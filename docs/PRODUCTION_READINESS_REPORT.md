# Production readiness report

Statuses: **PASS** implemented and verified with evidence · **FAIL** tested and not working · **BLOCKED** needs something unavailable here · **NOT TESTED** not verified in this environment.

Environment: Linux container, Node 22, Playwright 1.56.1. Browsers: Chromium 1194 (Playwright build) and Chromium 141, both open-source builds **without H.264**; Chrome for Testing 131 **with H.264/AAC**. (An earlier revision of this report called the Chromium 141 binary "a system Chrome"; it is not Chrome and cannot decode H.264.) No provider account, no access to the public internet beyond package registries and GitHub, nothing deployed.

## Summary of changes

| File | Purpose |
|---|---|
| `src/lib/url.js` (new) | Single `isSafeUrl`: https/localhost only, same-origin paths, no credentials/control characters/backslashes |
| `src/config.js` | `validateConfig`; malformed playback or metadata settings are reported by name and block use |
| `src/playback/catalog.js` | Strict `parseCatalog`, `CatalogError`, `mime`/`codecs` validation, rejected-source count, failures not cached, 15 s timeout |
| `src/playback/resolve.js`, `availability.js` | Resolver 10 s timeout, reason codes, "can't tell" never becomes "not streaming", distinct copy per reason |
| `src/playback/support.js` | HTTP-status classification, one-byte probe, codec-aware source choice |
| `src/components/Player.jsx` | Uses the probe; stale answers cancelled on teardown |
| `src/context/Catalog.jsx`, `States.jsx`, `pages/Library.jsx` | Catalogue load failure shows an error with *Try again* |
| `src/api/tmdb.js`, `errors.js` | Key never sent to a malformed host; relative proxy path; env captured at load |
| `pages/Watch.jsx`, `MovieDetails.jsx` | Pass the reason to the UI; no retry offered for `config`/`invalid` |
| `scripts/postbuild.js`, `package.json`, lockfile, `.gitignore` | Honour `BUILD_PATH`; `prebuild` and `test:e2e` scripts; declare `@playwright/test`; ignore e2e artefacts |
| `src/__tests__/urlSafety.test.js`, `metadataGuard.test.js` (new) | Tests for the above |
| `docs/*`, `README.md` | This report, the audit, failure reasons and test commands |

No framework, design or route changes; no new runtime dependencies.

## Frontend readiness

| Item | Status | Method and result |
|---|---|---|
| Lint | PASS | `npm run lint`, exit 0 |
| Unit and component tests | PASS | `CI=true npm run test:ci`: 12 suites, 120/120 (baseline 54/77) |
| Production build | PASS | `npm run build` incl. `prebuild` guard; `404.html`, sitemap, robots written |
| No API key value in bundle | PASS | Build had no key set; the only `api_key` match is the parameter name in code. Re-check with your real key |
| Library error and empty states | PASS | `libraryStates` unit tests |
| Watchlist persistence and corrupted storage | PASS | e2e, both browser projects |
| Phone-width layout, no horizontal overflow | PASS | e2e at phone size (one viewport only) |
| Keyboard and screen-reader accessibility audit | NOT TESTED | No automated or manual a11y audit was run |
| Document titles / SEO metadata beyond sitemap | NOT TESTED | Not inspected this pass |

## Playback-engine readiness

| Item | Status | Method and result |
|---|---|---|
| Progressive MP4 loads and plays, no console errors | PASS | e2e, Chromium and Chrome |
| Seek forward/back with real range requests; pause/resume | PASS | e2e |
| Progress saved, resume offered, Continue watching resumes | PASS | e2e |
| Reaches the actual end; completion state; progress cleared | PASS | e2e, plus the **real-time 180 s run** (`E2E_FULL=1`, 3.0 min, Chromium): progress saved mid-play, `currentTime` reached duration, progress cleared |
| Subtitle track loads | PASS | e2e |
| Teardown releases the connection (progressive) | PASS | e2e: element emptied, no further downloads |
| Expired link (403) explained, no pointless retry | PASS | e2e |
| Missing file (404): retry capped at three | PASS | e2e |
| Browser that can play nothing says so | PASS | e2e |
| Whole-film real-time run (180 s) on H.264 Chrome for Testing 131 | NOT TESTED | The real-time run was done on open-source Chromium only (PASS, see above) |
| HLS via hls.js: multi-segment play, capped network retry, destroy on unmount | PASS | e2e on **Chrome for Testing 131** (H.264/AAC): 3 of 3 pass (plays across segments; network failure surfaces, is capped, Try again resumes; hls.js destroyed on unmount). They skip on the open-source Chromium builds, which cannot decode H.264 over MSE |
| Race: status probe answering after the player is closed | NOT TESTED | Guarded in code (probe replaced on teardown) but no test forces the race |
| Native HLS (Safari) | NOT TESTED | No Safari available |

## Provider integration readiness

| Item | Status | Method and result |
|---|---|---|
| Catalogue-driven sources | PASS | Unit tests and e2e against the fixture catalogue |
| Resolver contract (`GET {url}/{id}`): statuses, malformed bodies, timeout | PASS | Unit tests (`playbackHardening`) with mocked `fetch`; this proves the client's handling, not any real service |
| A real provider or signing resolver | BLOCKED | None is configured and no credentials exist. Requires your own server returning the entry shape in `docs/STREAMING.md`, keeping secrets server-side |

## Content availability

| Item | Status | Result |
|---|---|---|
| Real film available to stream | BLOCKED | `public/catalog.json` lists no films. Big Buck Bunny is prepared in `docs/candidates/` but not live: its media file could not be verified from this environment (see below) |
| Test film | PASS (fixture only) | `e2e/fixtures/media` is a generated test film used for verification, not content to ship |

## Full-film source: Big Buck Bunny (TMDB 10378)

Details and the exact finishing steps are in [SOURCES.md](SOURCES.md).

| Item | Status | Method and result |
|---|---|---|
| Starter catalogue entry present in the supplied ZIP | FAIL | The ZIP supplied for this task contained `"titles": {}`, byte-identical to the previous delivery. There was no entry or URL to verify |
| Licence: CC BY 3.0 and attribution terms | PASS (documentary) | peach.blender.org/about, read 2026-10-18. Requires the entire credits roll when the whole movie is screened. Not legal advice |
| Official release locations | PASS (documentary) | peach.blender.org/download names `download.blender.org/peach/bigbuckbunny_movies/` and `.../demo/movies/BBB/`; the latter lists only `.zip` files (not streamable) |
| Candidate file `BigBuckBunny_320x180.mp4` is reachable, is video, has a video MIME, supports ranges, is H.264, is the complete film with credits | NOT TESTED | The sandbox cannot resolve `download.blender.org` (DNS failure) and the old-release listing is blocked to the fetch tool. The filename is referenced by third-party repos only, which is not verification |
| Cross-origin (CORS) headers of that host | NOT TESTED | Same reason. Plain playback does not need CORS; subtitles from the host and expired-link diagnosis would |
| Big Buck Bunny live in `public/catalog.json` | NOT DONE (by design) | Adding an unverified URL would claim availability the evidence does not support |
| Real-browser playback of the real film | BLOCKED | Needs internet access to the media host. One command is provided (`e2e/real-source.spec.js`) |

### Tooling added to close that gap

| Item | Status | Method and result |
|---|---|---|
| `npm run verify:source` (reachable, real video bytes, MIME, ranges, CORS, codec, duration floor, tail frame; refuses to edit the catalogue unless all pass) | PASS | Unit tests (12, incl. HTML-as-video, no ranges, wrong MIME, http redirect, clip-length, bad codec, unreachable). Run against a real local film over HTTP: all checks pass; same film rejected when the duration floor is raised; unsafe or missing sources rejected |
| Candidate entry and catalogue policy | PASS | `catalogConfig.test.js` (9): keyed by TMDB 10378 only; https MP4 on `download.blender.org`; licence name/holder/https link present; resolves to full-film even with a trailer; unsafe, unsupported, withdrawn and expired variants refused; every `available` entry in `public/catalog.json` must carry licence metadata |
| `e2e/real-source.spec.js`: film page says "Watch in full", Watch opens the player, real URL loads, duration floor, pause/resume, volume, seek forward and back, progress saved, resume prompt returns near the saved position, end reached, progress cleared, no console errors, tail frame saved | PASS (on a stand-in) | Passed on Chrome for Testing 131 against the generated local film (`E2E_REAL_MIN_DURATION=120`). Not yet run against the real film |
| Verifier mechanics on a real file: tail-frame extraction | PASS | Frame at 2:56 of 3:00 captured |

Controlled failure, retry and trailer-separation behaviour are covered by the existing suite (expired 403, missing 404 with capped retries, trailer-only never offers the film).


## Deployment readiness

| Item | Status | Result |
|---|---|---|
| Base path `/movie-app/` and `404.html` deep-link fallback | PASS | e2e, built with the production base path |
| Actual deployment to GitHub Pages | NOT TESTED | Nothing deployed; no authorization |
| `REACT_APP_SITE_URL`, TMDB key set in the production build | NOT TESTED | Not provided here |
| Dependency audit | FAIL (unchanged) | 106 advisories, 3 critical. All criticals are build/dev-server toolchain; `react-router-dom` moderate ships and needs a v7 upgrade. See `PRODUCTION_AUDIT.md` |
| CORS / MIME / range-request hosting for your video host | NOT TESTED | Depends on your host; requirements are in `docs/STREAMING.md` |

## Before this can go live

1. Run the Big Buck Bunny steps in `docs/SOURCES.md` (verify, look at the credits frame, apply, real-browser spec), or supply another authorized source.
2. Optional: run the real-time whole-film test on an H.264 Chrome (`E2E_FULL=1`).
3. Decide on the `react-router-dom` v7 upgrade and the `react-scripts` toolchain.
4. Set `REACT_APP_SITE_URL` and the TMDB variables, build, deploy, and re-run the base-path tests against the deployed URL.
5. Run an accessibility pass.

## Re-verification run (2026-10-18, this delivery)

Environment: Linux container, Node 22.22, npm 10.9, Playwright Chromium (open-source, no H.264). The sandbox egress policy answered **403 to CONNECT** for `download.blender.org`, `peach.blender.org`, `upload.wikimedia.org`, `commons.wikimedia.org`, `archive.org` and `themoviedb.org`, so no media host could be reached. No workaround was attempted.

| Check | Result |
|---|---|
| `npm ci` | OK, lockfile consistent |
| `npm run lint` | exit 0, 2 warnings (`no-script-url` in a test), 0 errors |
| `CI=true npm run test:ci` | 12 suites, **120/120 passed** |
| `npm run build` | OK; `build/404.html`, `sitemap.xml`, `robots.txt` present; `catalog.json` in build |
| `npm run test:e2e -- --rebuild` | **21 passed, 5 skipped, 0 failed**. Skips: HLS x3 and the H.264 real-source spec (open-source Chromium cannot decode H.264), the opt-in 180 s real-time run |
| Deep links through `404.html` on `/movie-app/` | PASS (e2e test 23) |
| API key in generated bundles | None found (grep for `api_key=<value>` in `build/` and `build-e2e/`) |
| `npm audit` | **106** (3 critical, 80 high, 18 moderate, 5 low). Unchanged: all criticals (`proxy-addr`, `shell-quote`, `websocket-driver`) are in the `react-scripts` dev-server/build toolchain, not browser code. `npm audit --omit=dev` still lists 105 because `react-scripts` is declared under `dependencies`; moving it to `devDependencies` is a safe follow-up but was not done here. |
| Big Buck Bunny live in `public/catalog.json` | **NOT DONE.** The source URL could not be reached, so MIME, ranges, codec, duration and the credits roll are unverified. `public/catalog.json` still has `"titles": {}`, and "Not yet configured" will keep showing |
| Real-browser playback of a real full film | **NOT VERIFIED** (blocked as above) |

The central acceptance criterion (an authorized complete film verified and playing) remains open. Finish it with the steps in `docs/SOURCES.md` from a machine that can reach the media host.
