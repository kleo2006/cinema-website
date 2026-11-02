# Streaming: configuring authorized sources

> Authorized-source evidence, attribution rules, and the `npm run verify:source` workflow are in [SOURCES.md](SOURCES.md).

Cinema never infers that a film is playable. A title plays only if it has an entry in the **catalogue** (or the optional **resolver** returns one). You must have the right to stream every title you list: your own films, licensed content from a provider that allows playback on your site, or verified public-domain / openly licensed works. Do not list pirated streams, and do not bypass DRM, paywalls, or geo-restrictions.

## Catalogue (`public/catalog.json` or `REACT_APP_PLAYBACK_CATALOG_URL`)
```json
{
  "version": 1,
  "titles": {
    "<tmdbId>": {
      "status": "available",
      "sources": [
        { "src": "https://cdn.example.com/film/master.m3u8", "type": "hls" },
        { "src": "https://cdn.example.com/film/film.mp4", "type": "mp4" }
      ],
      "subtitles": [{ "src": "https://cdn.example.com/film/en.vtt", "lang": "en", "label": "English" }],
      "license": { "name": "CC BY 3.0", "holder": "Rights holder", "url": "https://…" },
      "expiresAt": "2030-01-01T00:00:00Z"
    }
  }
}
```
- Key = the film's **TMDB id** (the number in `/movie/603-the-matrix`).
- `status`: `available` | `unavailable` (configured but offline) | `restricted` (provider refuses).
- `type`: `hls`, `mp4`, `webm`. List in order of preference; the first one the browser can play is used. HLS uses native support (Safari) or hls.js.
- URLs must be `https:` (plain `http:` only for localhost) or same-origin paths. Anything else is dropped.
- Past `expiresAt` the title is treated as unavailable.
- Subtitles (`.vtt`) from another origin need CORS headers.

Resulting states (never guessed from metadata): **Full film**, **Trailer only**, **Not streaming**, **Temporarily unavailable**, **Restricted**.

## Hosting requirements
- Video host must support HTTP **Range** requests (seeking) and send CORS headers if on another origin.
- Don't serve a full movie as one huge file you expect to be pre-downloaded: use HLS or a progressive MP4/WebM with `moov` at the front (`ffmpeg -movflags +faststart`).
- Browser codecs: MP4/H.264+AAC is the broadest; WebM/VP9 works in Chromium/Firefox; HLS covers adaptive bitrate.

## Secrets and signed URLs
Anything in the catalogue is public. If your provider needs a secret or short-lived signed URLs, set `REACT_APP_PLAYBACK_RESOLVER_URL` to a small server you control that checks entitlement and returns the same JSON entry shape for `GET {url}/{tmdbId}` (404 = no source, 401/403/451 = restricted). Never put provider tokens in `REACT_APP_*` variables. The player's **Try again** re-calls the resolver for a fresh link.

## Playback behaviour
- Native controls (play, seek, volume, captions, fullscreen); extra shortcuts when the video is focused: `K` play/pause, `J`/`L` ±10s, `M` mute, `F` fullscreen.
- No autoplay on page load; playback starts automatically only after the visitor pressed *Watch movie* (and is silently left paused if the browser blocks it).
- Progress is saved every ~5s and on pause/seek/hide, locally. Positions under 30s are ignored; within 90s of the end (or 95%) the film counts as finished and leaves *Continue watching*. Direct visits ask "Resume or start over?"; the Continue card resumes directly.
- Errors: unsupported format, network drop (incl. 20s buffering stall), expired link, restricted, decode, missing file — each with plain-language copy. Permanent errors never offer retry; retries are capped at 3.
- Leaving the page tears down the stream and decoder.

## Testing with your own fixture
Generate a clip you own: `ffmpeg -f lavfi -i testsrc2=size=480x270:rate=15:duration=240 -f lavfi -i sine -c:v libvpx-vp9 -c:a libopus test.webm`, host it with Range support, add it to a local catalogue, and use its TMDB id. Do not commit fixture entries into the production `public/catalog.json`.

## Why a title shows as unavailable (failure reasons)

When a title cannot be played the UI says why, using one of these reasons. None of them ever contains a URL, token or response body.

| Reason | Shown as | Typical cause | Fix |
|---|---|---|---|
| `expired` | Link expired | `expiresAt` is in the past (signed URL) | Refresh the catalogue entry, or use a resolver that signs per request |
| `invalid` | Source misconfigured | Every listed source was rejected (non-https, `javascript:`, bad `mime`/`codecs`, credentials in the URL), or the resolver returned something that is not an entry | Fix the entry; see the source rules below |
| `config` | Playback not set up | A `REACT_APP_PLAYBACK_*` variable is malformed | Fix the variable (the console names it, never its value) and rebuild |
| `catalog` | Film list unavailable | The catalogue file could not be fetched or is not a catalogue | Check the file is deployed, valid JSON, `"titles"` is an object; Library offers *Try again* |
| `timeout` / `network` / `server` | Playback service … / Temporarily unavailable | Resolver slow (10 s limit), unreachable, or answering 5xx | Check the resolver; visitors can retry |

An unreachable catalogue or resolver is never reported as "trailer only" or "not streaming", because those claim to know nothing is configured.

## Source rules (enforced when the catalogue is read)

- `src` must be `https://` (or `http://` for localhost), or a same-origin path starting with a single `/`. No credentials, control characters or backslashes.
- `type` is `mp4`, `webm` or `hls`. Optional `mime` must agree with `type` (`video/mp4`, `video/webm`, `application/vnd.apple.mpegurl` / `application/x-mpegurl`).
- Optional `codecs` (for example `"avc1.64001E, mp4a.40.2"`) must be a plain codec list. The browser is asked whether it can play that exact combination before the source is chosen, so an H.264-only source is skipped by a browser without H.264 and the next listed source is used.
- `"version"` must be `1` or omitted.

## Diagnosing an expired or missing file

A `<video>` element only reports "could not load". On such a failure the player asks the host for one byte (`Range: bytes=0-0`) to learn the HTTP status: 401/403/410 reads as an expired link, 451 as restricted, 404 as a missing file. If the host does not allow that cross-origin request (no CORS headers) the generic message is kept.

## Running the browser tests

```bash
npx playwright install chromium          # or set PLAYWRIGHT_BROWSERS_PATH / E2E_CHROME_PATH
npm run test:e2e -- --rebuild            # builds build-e2e/ then runs the suite
E2E_FULL=1 npm run test:e2e -- -g "whole film"   # plays the whole 180 s film in real time (~3 min)
```

The HLS tests skip themselves when the browser cannot decode H.264 through Media Source Extensions. Run them in a Chrome build that can (`E2E_CHROME_PATH=/path/to/chrome`).
