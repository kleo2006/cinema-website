# Authorized sources and attribution

`public/catalog.json` is the single place where authorized static playback sources are configured. **It currently lists no films.** Big Buck Bunny (TMDB 10378) is prepared but deliberately *not live*, because its media file could not be verified (below). This page records what is known, what is not, and the exact steps to finish.

## Big Buck Bunny: what is established

| Question | Status | Evidence |
|---|---|---|
| Is the film openly licensed for this use? | Established (licence text), not legal advice | peach.blender.org/about (read 2026-10-18): the Peach project results are released under **Creative Commons Attribution 3.0**, "also commercially", with proper attribution. |
| Required attribution | Established | Website/DVD files: "Blender Foundation \| www.blender.org". **Screening or broadcasting the entire movie: include the entire credits roll at the end.** Re-using parts: "(c) copyright 2008, Blender Foundation / www.bigbuckbunny.org". Logos and the DVD cover are excluded from the licence. |
| Where is the official release? | Established | peach.blender.org/download (read 2026-10-18) points to `https://download.blender.org/peach/bigbuckbunny_movies/` (old release) and `https://download.blender.org/demo/movies/BBB/` (4K/HFR/3D release). |
| What does the newer release contain? | Established | Its directory listing (read 2026-10-18) offers only `.mp4.zip` archives, e.g. `bbb_sunflower_1080p_30fps_normal.mp4.zip` (275,524,128 bytes). A browser cannot stream a ZIP. |
| Candidate direct file | **UNVERIFIED** | `https://download.blender.org/peach/bigbuckbunny_movies/BigBuckBunny_320x180.mp4` is referenced by many unrelated public projects, which is hearsay. The old-release directory listing could not be read (blocked to the automated fetcher), and the build sandbox cannot resolve `download.blender.org`, so reachability, MIME type, byte ranges, CORS, codec, duration and the end credits were **not checked**. |
| Is it the complete film with all credits? | **UNVERIFIED** | Needs a person to look at the last frames (the tool saves them, see below). |

The candidate entry is in `docs/candidates/bigbuckbunny.catalog-entry.json`. It is a 320x180 file, which is low resolution for a film page; see Option B for better quality.

## Finish it on your machine

Needs Node 18+, and `ffmpeg`/`ffprobe` installed (they check codecs and duration). Internet access is required.

```bash
# 1. Verify the candidate. Writes verify-out/report.json and verify-out/last-frames.png
npm run verify:source -- --url https://download.blender.org/peach/bigbuckbunny_movies/BigBuckBunny_320x180.mp4 --type mp4

# 2. Open verify-out/last-frames.png. It must show the END-CREDITS ROLL. If it does not, stop: the file is cut short.

# 3. Only if every check passed and the credits are there, add it to the catalogue:
npm run verify:source -- --url https://download.blender.org/peach/bigbuckbunny_movies/BigBuckBunny_320x180.mp4 --type mp4 \
  --apply --tmdb 10378 --license "CC BY 3.0" --holder "Blender Foundation | www.blender.org" \
  --license-url https://creativecommons.org/licenses/by/3.0/ --credits-confirmed

# 4. Prove it in a real browser, through the real UI (use an H.264-capable Chrome for MP4)
E2E_REAL_SOURCE_URL=https://download.blender.org/peach/bigbuckbunny_movies/BigBuckBunny_320x180.mp4 E2E_REAL_MIN_DURATION=540 \
  npm run test:e2e -- e2e/real-source.spec.js --project="chrome (H.264/AAC)"
```

What the verifier checks: URL safety (https, no credentials); the host answers; the first bytes are really an MP4/WebM/HLS stream and not an HTML page; the `Content-Type`; byte-range support (needed for seeking); CORS (advice only, since a plain `<video>` plays without it); browser-decodable codecs (H.264 + AAC for MP4; VP8/VP9/AV1 + Opus/Vorbis for WebM); and that the duration is at least `--min-duration` (default 540 s) so a clip or trailer cannot pass as the film. Anything it cannot check is reported as `SKIP` and counts as **not verified**. `--apply` refuses to write unless nothing failed or was skipped, you passed `--credits-confirmed`, and the licence fields are present.

If the host fails a check (typical: no byte ranges, wrong MIME, or the link has moved), do not edit the catalogue by hand. Use Option B.

## Option B: host the official higher-quality release yourself

CC BY 3.0 allows redistribution with attribution. Download `bbb_sunflower_1080p_30fps_normal.mp4.zip` from `https://download.blender.org/demo/movies/BBB/`, unzip it, and host the MP4 on a service that serves HTTPS, byte ranges and `Content-Type: video/mp4` (any object storage + CDN). GitHub Pages cannot host it (100 MB per-file limit). Then run steps 1–4 above with your URL. Keep the credits roll intact; do not trim or re-encode it away.

## Adding another authorized title

1. Confirm you have the right to stream it and note the licence and the required credit wording.
2. Find its TMDB id (the number in `themoviedb.org/movie/<id>-…`). That number is the catalogue key.
3. Host a progressive MP4/WebM or an HLS playlist you are allowed to serve (HTTPS, byte ranges, correct MIME).
4. Run `npm run verify:source` for the file; add it with `--apply`, or by hand using the schema in `docs/STREAMING.md` (a `license` with `name`, `holder`, `url` is required by policy here and enforced by `src/__tests__/catalogConfig.test.js`).
5. `npm run lint && CI=true npm run test:ci && npm run build`, then the real-browser spec above.

## Attribution in the product

The film page and the Watch page already show the licence name, holder and a link to the terms whenever a title has a `license` entry. The end credits are part of the video file; the player never skips them.

## Not claimed

No commercial or worldwide-rights statement is made beyond what the Peach licence page says. The generated test film in `e2e/fixtures` is for automated tests only and must never be listed in production.
