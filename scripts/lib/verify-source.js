/**
 * Checks that a candidate video URL is really a playable, complete film before it is allowed into public/catalog.json.
 * Pure logic lives here so it can be unit-tested with a fake `fetch` and a fake `probe`; scripts/verify-source.js is the CLI.
 *
 * Each check returns { id, status: "PASS" | "WARN" | "FAIL" | "SKIP", detail }. SKIP means "could not be checked here" and is
 * never treated as a pass: `ok(results)` is true only when nothing failed AND nothing was skipped. WARN is advice only.
 */
const EXPECTED = {
  mp4: { mimes: ["video/mp4"], magic: (b) => b.length >= 12 && b.slice(4, 8).toString("latin1") === "ftyp" },
  webm: { mimes: ["video/webm"], magic: (b) => b.length >= 4 && b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3 },
  hls: { mimes: ["application/vnd.apple.mpegurl", "application/x-mpegurl", "audio/mpegurl"], magic: (b) => b.slice(0, 7).toString("latin1") === "#EXTM3U" },
};
const BROWSER_VIDEO = { mp4: ["h264"], webm: ["vp8", "vp9", "av1"], hls: ["h264"] };
const BROWSER_AUDIO = { mp4: ["aac", "mp3"], webm: ["opus", "vorbis"], hls: ["aac"] };

const r = (id, status, detail) => ({ id, status, detail });
const mimeOf = (h) => (h.get("content-type") || "").split(";")[0].trim().toLowerCase();

async function checkSource({ url, type, minDuration = 540, origin = "https://example.github.io" }, { fetchImpl = fetch, probe = null } = {}) {
  const out = [];
  const expected = EXPECTED[type];
  if (!expected) return [r("type", "FAIL", `type must be one of ${Object.keys(EXPECTED).join(", ")}`)];

  let u;
  try {
    u = new URL(url);
  } catch {
    return [r("url", "FAIL", "not a valid URL")];
  }
  const local = ["localhost", "127.0.0.1"].includes(u.hostname);
  if (u.username || u.password || (u.protocol !== "https:" && !(u.protocol === "http:" && local))) {
    return [r("url", "FAIL", "must be https:// (http:// only for localhost) with no credentials")];
  }
  out.push(r("url", "PASS", "https, no credentials"));

  // 1) Real bytes, not an HTML error page: a one-byte-range-style request for the first KB.
  let res;
  let head = Buffer.alloc(0);
  try {
    res = await fetchImpl(url, { method: "GET", headers: { Range: "bytes=0-1023", Origin: origin }, redirect: "follow" });
    head = Buffer.from(await res.arrayBuffer());
  } catch (e) {
    out.push(r("reachable", "FAIL", `request failed: ${e.message}`));
    return out;
  }
  const finalUrl = res.url || url;
  if (!res.ok) return [...out, r("reachable", "FAIL", `HTTP ${res.status}`)];
  out.push(r("reachable", "PASS", `HTTP ${res.status}`));
  if (finalUrl.startsWith("http:") && !local) out.push(r("redirect", "FAIL", "redirected to a non-https URL"));
  else out.push(r("redirect", "PASS", finalUrl === url ? "no redirect" : "redirect stays on https"));

  out.push(
    expected.magic(head)
      ? r("video-data", "PASS", `first bytes are a ${type} stream, not HTML`)
      : r("video-data", "FAIL", `first bytes do not look like ${type}${head.slice(0, 15).toString("latin1").toLowerCase().includes("<!doctype") || head.slice(0, 6).toString("latin1").toLowerCase().includes("<html") ? " (it is an HTML page)" : ""}`),
  );

  const mime = mimeOf(res.headers);
  out.push(expected.mimes.includes(mime) ? r("mime", "PASS", mime) : r("mime", "FAIL", `Content-Type is "${mime || "missing"}", expected ${expected.mimes.join(" or ")}`));

  // 2) Seeking needs byte ranges (progressive files only; HLS seeks by segment).
  if (type === "hls") out.push(r("range", "SKIP", "not applicable to HLS manifests; check segments are served with the same rules"));
  else if (res.status === 206 && /^bytes 0-\d+\/\d+$/.test(res.headers.get("content-range") || "")) out.push(r("range", "PASS", `206 ${res.headers.get("content-range")}`));
  else out.push(r("range", "FAIL", `a Range request returned HTTP ${res.status}; the host does not support byte ranges, so seeking will not work`));

  // 3) CORS: not needed to *play* a <video>, but needed for subtitles, the expired-link probe and hls.js.
  const acao = res.headers.get("access-control-allow-origin");
  out.push(acao === "*" || acao === origin ? r("cors", "PASS", `Access-Control-Allow-Origin: ${acao}`) : r("cors", type === "hls" ? "FAIL" : "WARN", acao ? `allows ${acao}, not this site` : "no CORS header: plain playback works, but subtitles from this host, the expired-link diagnosis, and hls.js need it"));

  // 4) Codec, duration and the end of the film come from a real decoder, not from headers.
  if (!probe) {
    out.push(r("codec", "SKIP", "ffprobe not available: install ffmpeg to check codecs and duration"));
    out.push(r("duration", "SKIP", "ffprobe not available"));
    return out;
  }
  let info;
  try {
    info = await probe(url);
  } catch (e) {
    out.push(r("codec", "FAIL", `ffprobe could not read the file: ${e.message}`));
    return out;
  }
  const v = (info.streams || []).find((s) => s.codec_type === "video");
  const a = (info.streams || []).find((s) => s.codec_type === "audio");
  out.push(v && BROWSER_VIDEO[type].includes(v.codec_name) && (!v.pix_fmt || v.pix_fmt === "yuv420p") ? r("codec", "PASS", `video ${v.codec_name} ${v.pix_fmt || ""} ${v.width}x${v.height}`.trim()) : r("codec", "FAIL", `video is ${v ? `${v.codec_name} ${v.pix_fmt}` : "missing"}; browsers need ${BROWSER_VIDEO[type].join("/")} yuv420p`));
  out.push(!a || BROWSER_AUDIO[type].includes(a.codec_name) ? r("audio", "PASS", a ? `audio ${a.codec_name}` : "no audio track") : r("audio", "FAIL", `audio is ${a.codec_name}; browsers need ${BROWSER_AUDIO[type].join("/")}`));
  const dur = Number(info.format?.duration);
  out.push(Number.isFinite(dur) && dur >= minDuration ? r("duration", "PASS", `${dur.toFixed(1)} s (floor ${minDuration} s)`) : r("duration", "FAIL", `duration ${Number.isFinite(dur) ? `${dur.toFixed(1)} s` : "unknown"} is below the ${minDuration} s floor: this looks like a clip or a trailer, not the full film`));
  return out;
}

const ok = (results) => results.length > 0 && results.every((x) => x.status === "PASS" || x.status === "WARN");
const blockers = (results) => results.filter((x) => x.status === "FAIL" || x.status === "SKIP");

module.exports = { checkSource, ok, blockers };
