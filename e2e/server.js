/**
 * Test server for the browser tests. It reproduces what matters about GitHub Pages and a media host:
 *  - the app lives under /movie-app/ and unknown paths get 404.html with a 404 status (the SPA fallback trick);
 *  - /media/* is served with real HTTP Range support, correct MIME types and no caching, so seeking is real;
 *  - /movie-app/catalog.json is the TEST catalogue (e2e/fixtures/catalog.json), never the production one;
 *  - /media/expired.mp4 answers 403 (an expired signed URL); /media/missing.mp4 simply does not exist (404);
 *  - /tmdb/* is a tiny METADATA stub (title/runtime/overview only). Playback is never stubbed.
 *  - /__stats reports media request counts and open connections, so tests can prove downloads stop after the player closes.
 */
const http = require("http");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const BASE = "/movie-app";
const PORT = Number(process.env.E2E_PORT || 4173);
const BUILD = path.resolve(root, process.env.E2E_BUILD_DIR || "build-e2e");
const MEDIA = path.join(__dirname, "fixtures", "media");

const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".png": "image/png", ".ico": "image/x-icon", ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".woff": "font/woff", ".map": "application/json",
  ".mp4": "video/mp4", ".m4s": "video/mp4", ".webm": "video/webm", ".m3u8": "application/vnd.apple.mpegurl", ".vtt": "text/vtt; charset=utf-8",
};

const stats = { mediaRequests: 0, rangeRequests: 0, nonZeroRangeRequests: 0, active: 0, paths: {} };
const resetStats = () => Object.assign(stats, { mediaRequests: 0, rangeRequests: 0, nonZeroRangeRequests: 0, active: 0, paths: {} });

const send = (res, status, body, headers = {}) => {
  res.writeHead(status, { "Content-Length": Buffer.byteLength(body), ...headers });
  res.end(body);
};
const json = (res, status, obj) => send(res, status, JSON.stringify(obj), { "Content-Type": "application/json", "Cache-Control": "no-store" });

function film(id) {
  const trailer = id === 9008 ? [{ site: "YouTube", type: "Trailer", key: "TESTKEY0001", official: true, name: "Test trailer" }] : [];
  return {
    id, title: `Cinema Test Film ${id}`, overview: "A synthetic test pattern used to verify playback. Metadata only: this record says nothing about streaming rights.",
    release_date: "2026-01-01", runtime: 3, vote_average: 7.5, vote_count: 100, status: "Released", genres: [{ id: 18, name: "Drama" }],
    poster_path: null, backdrop_path: null, videos: { results: trailer }, credits: { cast: [], crew: [] }, recommendations: { results: [] }, similar: { results: [] },
  };
}

function serveMedia(req, res, file) {
  let stat;
  try {
    stat = fs.statSync(file);
    if (!stat.isFile()) throw new Error("not a file");
  } catch {
    return send(res, 404, "Not found", { "Content-Type": "text/plain" });
  }
  const type = MIME[path.extname(file)] || "application/octet-stream";
  const headers = { "Content-Type": type, "Accept-Ranges": "bytes", "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" };
  const rel = path.relative(MEDIA, file);
  stats.mediaRequests += 1;
  stats.paths[rel] = (stats.paths[rel] || 0) + 1;
  let start = 0;
  let end = stat.size - 1;
  let status = 200;
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || "");
  if (range) {
    stats.rangeRequests += 1;
    if (range[1] === "" && range[2] !== "") {
      start = Math.max(0, stat.size - Number(range[2]));
    } else {
      start = Number(range[1] || 0);
      if (range[2] !== "") end = Math.min(Number(range[2]), end);
    }
    if (start > end || start >= stat.size) {
      res.writeHead(416, { "Content-Range": `bytes */${stat.size}`, ...headers });
      return res.end();
    }
    if (start > 0) stats.nonZeroRangeRequests += 1;
    status = 206;
    headers["Content-Range"] = `bytes ${start}-${end}/${stat.size}`;
  }
  headers["Content-Length"] = end - start + 1;
  res.writeHead(status, headers);
  if (req.method === "HEAD") return res.end();
  stats.active += 1;
  const stream = fs.createReadStream(file, { start, end });
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    stats.active -= 1;
    stream.destroy();
  };
  res.on("close", finish);
  stream.on("end", finish);
  stream.on("error", finish);
  stream.pipe(res);
}

function serveStatic(req, res, pathname) {
  let rel = decodeURIComponent(pathname.slice(BASE.length)) || "/";
  if (rel.endsWith("/")) rel += "index.html";
  const file = path.normalize(path.join(BUILD, rel));
  if (!file.startsWith(BUILD)) return send(res, 400, "Bad request");
  if (fs.existsSync(file) && fs.statSync(file).isFile()) {
    return send(res, 200, fs.readFileSync(file), { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
  }
  // GitHub Pages behaviour: unknown path -> 404.html, with a 404 status.
  const fallback = path.join(BUILD, "404.html");
  if (fs.existsSync(fallback)) return send(res, 404, fs.readFileSync(fallback), { "Content-Type": MIME[".html"] });
  return send(res, 404, "Not found");
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const p = url.pathname;
  if (p === "/__stats") return json(res, 200, stats);
  if (p === "/__stats/reset") return resetStats(), json(res, 200, { ok: true });
  if (p === "/media/expired.mp4") return send(res, 403, "Forbidden", { "Content-Type": "text/plain", "Access-Control-Allow-Origin": "*" });
  if (p.startsWith("/media/")) return serveMedia(req, res, path.join(MEDIA, path.normalize(decodeURIComponent(p.slice(7))).replace(/^(\.\.[/\\])+/, "")));
  if (p === `${BASE}/catalog.json`) return send(res, 200, fs.readFileSync(path.join(__dirname, "fixtures", "catalog.json")), { "Content-Type": MIME[".json"], "Cache-Control": "no-store" });
  if (p.startsWith("/tmdb/")) {
    const m = /^\/tmdb\/movie\/(\d+)$/.exec(p);
    if (m) return json(res, 200, film(Number(m[1])));
    if (p === "/tmdb/genre/movie/list") return json(res, 200, { genres: [{ id: 18, name: "Drama" }] });
    return json(res, 200, { results: [], page: 1, total_pages: 1, total_results: 0 });
  }
  if (p === BASE) {
    res.writeHead(301, { Location: `${BASE}/` });
    return res.end();
  }
  if (p.startsWith(`${BASE}/`)) return serveStatic(req, res, p);
  return send(res, 404, "Not found", { "Content-Type": "text/plain" });
});

server.listen(PORT, "127.0.0.1", () => console.log(`e2e server on http://127.0.0.1:${PORT}${BASE}/ (build: ${path.relative(root, BUILD)})`));
