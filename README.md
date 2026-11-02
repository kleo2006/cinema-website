# Cinema — film discovery and streaming

A React single-page app for discovering films (metadata from [TMDB](https://www.themoviedb.org/)), keeping a watchlist, and **watching films in full when an authorized source is configured**. Trailers are always labelled as trailers and never stand in for a film.

> **Important:** TMDB provides metadata and artwork only. It gives no right to stream a film. Cinema plays a film only if *you* list an authorized source for it (see [docs/STREAMING.md](docs/STREAMING.md)). The repository ships with an **empty catalogue**, so out of the box no film is playable and the UI says so honestly.

## Features
- Home with featured hero, shelves (trending, popular, top rated, coming soon, genre collections), Continue watching and watchlist highlights
- Discover with URL-shareable filters (genre, year, rating, release status) and sorting; genre browsing; "See all" pages
- Search with debounced suggestions (ARIA combobox), recent searches, shareable `/search?q=`
- Film pages: synopsis, cast, director, trailer dialog, related films, playback availability, share
- In-site player (native HTML5 controls + hls.js for HLS), resume prompt, progress saved on this device, retry/error handling
- Watchlist and progress persisted in `localStorage` (this browser only — **not** synced across devices)
- Responsive (320px → ultrawide), dark cinematic theme, reduced-motion support, keyboard accessible

## Stack
React 18 · React Router 6 · Create React App 5 · plain CSS with design tokens (`src/styles/tokens.css`) · lucide-react icons · hls.js (loaded only when an HLS source needs it) · self-hosted fonts via Fontsource.

## Setup
```bash
npm install
cp .env.example .env      # then add your TMDB v3 API key
npm start                 # http://localhost:3000/movie-app  (see "Base path")
```
| Command | Purpose |
|---|---|
| `npm start` | Dev server |
| `npm run build` | Production build + `postbuild` (404.html SPA fallback, sitemap.xml, robots) |
| `npm test` / `npm run test:ci` | Jest + Testing Library (watch / single run) |
| `npm run lint` | ESLint |
| `npm run deploy` | Publish `build/` to GitHub Pages (`gh-pages`) |

**Base path:** `package.json` has `"homepage": "https://kleo2006.github.io/movie-app"`, so the app (including `npm start`) is served under `/movie-app`. For a domain root, change `homepage` (or remove it) and set `REACT_APP_SITE_URL`.

## Environment variables
All `REACT_APP_*` values are embedded in the public bundle. See `.env.example`.

| Variable | Purpose |
|---|---|
| `REACT_APP_API_KEY` | TMDB v3 key. **Visible to anyone who opens the site.** For a private key, leave empty and use the proxy below. |
| `REACT_APP_TMDB_BASE_URL` | Optional proxy (e.g. a Cloudflare Worker) that adds the key server-side. |
| `REACT_APP_PLAYBACK_CATALOG_URL` | Catalogue JSON of titles you may stream. Default `/catalog.json`. |
| `REACT_APP_PLAYBACK_RESOLVER_URL` | Optional server returning a fresh/signed source per title: `GET {url}/{tmdbId}`. |
| `REACT_APP_SITE_URL` | Public origin for canonical URLs, social tags and `sitemap.xml`. |

`.env` is git-ignored. If a real key was ever committed or shared, rotate it in your TMDB account.

## Architecture
```
src/api/        TMDB access (one entry point, cache, typed errors), normalisation, image URLs
src/playback/   availability model, catalogue validation, source resolution, player support logic
src/store/      localStorage-backed stores (watchlist, progress, searches) with validation
src/components/ UI building blocks (Header, MovieCard, Hero, Shelf, Player, dialogs…)
src/pages/      route components (lazy-loaded except Home)
src/styles/     tokens → base → components → pages
```
Metadata, trailers and full-length sources are **separate**: a film is playable only when `src/playback` resolves an authorized source for it.

## Deployment
Static hosting is enough. `postbuild` writes `404.html` (GitHub Pages SPA fallback); `public/_redirects` covers Netlify/Cloudflare Pages. A server is only needed if you use a TMDB key proxy or a signed-URL resolver.

## SEO note
Titles and meta tags are set client-side per page. Crawlers that don't run JavaScript see only the defaults in `public/index.html`; film pages are not pre-rendered. Moving to SSR/prerendering would be a separate project.

## Known limitations
- No authorized full-length catalogue ships with the repo; real playback depends on what you add.
- Watchlist/progress live in one browser; there are no accounts.
- Quality of live TMDB data and the real catalogue were not exercised in the author's sandbox (see "Verification" in the engineering report).
- `react-scripts` 5 is unmaintained and carries known transitive `npm audit` advisories (dev tooling); migrating to Vite is a sensible follow-up.

## Testing and verification

```bash
npm run lint
CI=true npm run test:ci        # unit and component tests
npm run test:e2e -- --rebuild  # real-browser playback tests (Playwright); see docs/STREAMING.md
npm run build                  # runs scripts/check-env.js first, then writes 404.html / sitemap / robots
```

Adding a film, its attribution, and the source verifier: [docs/SOURCES.md](docs/SOURCES.md). Current verified status, with evidence and the items that are blocked or untested, is in [docs/PRODUCTION_READINESS_REPORT.md](docs/PRODUCTION_READINESS_REPORT.md); the initial findings are in [docs/PRODUCTION_AUDIT.md](docs/PRODUCTION_AUDIT.md).
