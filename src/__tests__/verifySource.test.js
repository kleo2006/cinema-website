const { checkSource, ok, blockers } = require("../../scripts/lib/verify-source");

const MP4_HEAD = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from("ftypisom"), Buffer.alloc(32)]);
const WEBM_HEAD = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0, 0, 0, 0]);

function reply({ status = 206, body = MP4_HEAD, mime = "video/mp4", range = "bytes 0-1023/9999999", cors = "*", url = "https://media.example.com/film.mp4" } = {}) {
  const h = { "content-type": mime, ...(range ? { "content-range": range } : {}), ...(cors ? { "access-control-allow-origin": cors } : {}) };
  return { ok: status >= 200 && status < 300, status, url, headers: { get: (k) => h[k.toLowerCase()] ?? null }, arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) };
}
const probeOf = (over = {}) => async () => ({
  streams: [{ codec_type: "video", codec_name: "h264", pix_fmt: "yuv420p", width: 1280, height: 720, ...over.video }, { codec_type: "audio", codec_name: "aac", ...over.audio }],
  format: { duration: "596.5", ...over.format },
});
const run = (replyOpts, probe = probeOf(), input = {}) =>
  checkSource({ url: "https://media.example.com/film.mp4", type: "mp4", ...input }, { fetchImpl: jest.fn(async () => reply(replyOpts)), probe });
const status = (results, id) => results.find((x) => x.id === id)?.status;

test("a genuine, seekable, browser-compatible, full-length MP4 passes every check", async () => {
  const results = await run();
  expect(ok(results)).toBe(true);
  expect(blockers(results)).toEqual([]);
});

test("an HTML page served with 200 is not video data", async () => {
  const results = await run({ status: 200, body: Buffer.from("<!doctype html><html>Not found</html>"), mime: "text/html", range: null });
  expect(status(results, "video-data")).toBe("FAIL");
  expect(status(results, "mime")).toBe("FAIL");
  expect(ok(results)).toBe(false);
});

test("a wrong MIME type, or a host without byte ranges, fails", async () => {
  expect(status(await run({ mime: "application/octet-stream" }), "mime")).toBe("FAIL");
  const noRange = await run({ status: 200, range: null });
  expect(status(noRange, "range")).toBe("FAIL");
  expect(ok(noRange)).toBe(false);
});

test("a redirect to plain http fails", async () => {
  expect(status(await run({ url: "http://media.example.com/film.mp4" }), "redirect")).toBe("FAIL");
});

test("an unsafe URL is refused before any request is made", async () => {
  for (const url of ["http://media.example.com/a.mp4", "javascript:alert(1)", "https://u:p@media.example.com/a.mp4", "not a url"]) {
    const fetchImpl = jest.fn();
    const results = await checkSource({ url, type: "mp4" }, { fetchImpl });
    expect(ok(results)).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  }
});

test("localhost over http is allowed (development)", async () => {
  const results = await checkSource({ url: "http://127.0.0.1:4173/media/film.mp4", type: "mp4" }, { fetchImpl: async () => reply({ url: "http://127.0.0.1:4173/media/film.mp4" }), probe: probeOf() });
  expect(ok(results)).toBe(true);
});

test("without ffprobe, codec and duration are SKIPPED and the source is not verified", async () => {
  const results = await run({}, null);
  expect(status(results, "codec")).toBe("SKIP");
  expect(status(results, "duration")).toBe("SKIP");
  expect(ok(results)).toBe(false);
});

test("a clip is not a film: duration under the floor fails with that explanation", async () => {
  const results = await run({}, probeOf({ format: { duration: "52.0" } }));
  expect(status(results, "duration")).toBe("FAIL");
  expect(results.find((x) => x.id === "duration").detail).toMatch(/clip or a trailer/);
});

test("codecs a browser cannot decode fail", async () => {
  expect(status(await run({}, probeOf({ video: { codec_name: "hevc" } })), "codec")).toBe("FAIL");
  expect(status(await run({}, probeOf({ video: { pix_fmt: "yuv444p" } })), "codec")).toBe("FAIL");
  expect(status(await run({}, probeOf({ audio: { codec_name: "ac3" } })), "audio")).toBe("FAIL");
});

test("an unreadable file and an unreachable host both fail", async () => {
  expect(status(await run({}, async () => { throw new Error("Invalid data found"); }), "codec")).toBe("FAIL");
  const down = await checkSource({ url: "https://media.example.com/f.mp4", type: "mp4" }, { fetchImpl: async () => { throw new Error("getaddrinfo ENOTFOUND"); } });
  expect(status(down, "reachable")).toBe("FAIL");
  expect(status(await run({ status: 404 }), "reachable")).toBe("FAIL");
});

test("missing CORS on a progressive file is advice (WARN), not a blocker, because <video> plays without it", async () => {
  const results = await run({ cors: null });
  expect(status(results, "cors")).toBe("WARN");
  expect(ok(results)).toBe(true);
});

test("webm and hls are checked by their own signatures and MIME types", async () => {
  const webm = await checkSource({ url: "https://m.example.com/f.webm", type: "webm" }, { fetchImpl: async () => reply({ body: WEBM_HEAD, mime: "video/webm", url: "https://m.example.com/f.webm" }), probe: probeOf({ video: { codec_name: "vp9" }, audio: { codec_name: "opus" } }) });
  expect(ok(webm)).toBe(true);
  const hlsBad = await checkSource({ url: "https://m.example.com/f.m3u8", type: "hls" }, { fetchImpl: async () => reply({ status: 200, body: MP4_HEAD, mime: "application/vnd.apple.mpegurl", range: null, url: "https://m.example.com/f.m3u8" }), probe: probeOf() });
  expect(status(hlsBad, "video-data")).toBe("FAIL");
});
