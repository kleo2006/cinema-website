/* eslint-disable no-script-url -- javascript: URLs are deliberately used as hostile test input */
import { validateConfig } from "../config";
import { Availability, describeAvailability } from "../playback/availability";
import { CatalogError, parseCatalog, validateEntry } from "../playback/catalog";
import { PlayerError, classifyHlsError, classifyHttpStatus, pickSource, probeSourceStatus } from "../playback/support";

const checkEnv = require("../../scripts/check-env.js");

const jsonResponse = (body, init = {}) => ({ ok: true, status: 200, json: async () => body, ...init });
const goodCatalog = { version: 1, titles: { 603: { status: "available", sources: [{ src: "https://cdn.example.com/a.mp4", type: "mp4" }] } } };

/** resolve.js and catalog.js read config at import time, so each scenario loads fresh copies with its own env. */
function load(env = {}) {
  const saved = { ...process.env };
  Object.assign(process.env, { REACT_APP_PLAYBACK_CATALOG_URL: "", REACT_APP_PLAYBACK_RESOLVER_URL: "", ...env });
  let mods;
  jest.isolateModules(() => {
    mods = { resolve: require("../playback/resolve"), catalog: require("../playback/catalog") };
  });
  process.env = saved;
  return mods;
}

let warn;
beforeEach(() => {
  warn = jest.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  warn.mockRestore();
  delete global.fetch;
});

describe("catalogue structure and loading", () => {
  test("parseCatalog rejects things that are not a catalogue, accepts an empty one", () => {
    for (const bad of [null, "x", [], 42, {}, { titles: [] }, { titles: null }, { version: 2, titles: {} }]) expect(() => parseCatalog(bad)).toThrow(CatalogError);
    expect(parseCatalog({ version: 1, titles: {} }).size).toBe(0);
    expect(parseCatalog(goodCatalog).get(603).sources).toHaveLength(1);
  });

  test("a failed load is not cached as an empty catalogue: the next call retries", async () => {
    const { catalog } = load();
    global.fetch = jest.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(jsonResponse(goodCatalog));
    await expect(catalog.loadCatalog()).rejects.toBeInstanceOf(catalog.CatalogError);
    const loaded = await catalog.loadCatalog();
    expect(loaded.get(603)).toBeDefined();
    expect(global.fetch).toHaveBeenCalledTimes(2);
    await catalog.loadCatalog(); // success is cached
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  test.each([
    ["HTTP error", () => jsonResponse(null, { ok: false, status: 404 })],
    ["invalid JSON", () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError("bad"); } })],
    ["wrong structure", () => jsonResponse({ hello: "world" })],
  ])("%s rejects with CatalogError", async (_name, make) => {
    const { catalog } = load();
    global.fetch = jest.fn().mockResolvedValue(make());
    await expect(catalog.loadCatalog()).rejects.toBeInstanceOf(catalog.CatalogError);
  });
});

describe("source validation", () => {
  const src = (over) => validateEntry({ sources: [{ src: "https://x.test/a.mp4", type: "mp4", ...over }] });
  test("optional MIME must agree with the type", () => {
    expect(src({ mime: "video/mp4" }).sources).toHaveLength(1);
    expect(src({ mime: "video/mp4; codecs=avc1" }).sources).toHaveLength(1);
    expect(src({ mime: "video/webm" }).sources).toHaveLength(0);
    expect(src({ mime: 5 }).sources).toHaveLength(0);
    expect(validateEntry({ sources: [{ src: "https://x.test/a.m3u8", type: "hls", mime: "application/vnd.apple.mpegurl" }] }).sources).toHaveLength(1);
    expect(validateEntry({ sources: [{ src: "https://x.test/a.m3u8", type: "hls", mime: "video/mp4" }] }).sources).toHaveLength(0);
  });
  test("optional codecs must look like a codec list", () => {
    expect(src({ codecs: "avc1.64001E, mp4a.40.2" }).sources[0].codecs).toBe("avc1.64001E, mp4a.40.2");
    expect(src({ codecs: 'avc1"; evil=' }).sources).toHaveLength(0);
  });
  test("credentials inside a URL are rejected", () => {
    expect(src({ src: "https://user:pass@cdn.example.com/a.mp4" }).sources).toHaveLength(0);
  });
  test("rejected sources are counted so the resolver can say 'invalid', not 'none'", () => {
    const e = validateEntry({ sources: [{ src: "javascript:alert(1)", type: "mp4" }, { src: "https://x.test/b.mp4", type: "avi" }] });
    expect(e.sources).toHaveLength(0);
    expect(e.rejectedSources).toBe(2);
  });
});

describe("resolvePlayback outcomes", () => {
  test("catalogue that cannot be loaded is 'unavailable (catalog)', never 'trailer only' or 'none'", async () => {
    const { resolve } = load();
    global.fetch = jest.fn().mockRejectedValue(new Error("offline"));
    const r = await resolve.resolvePlayback(603, { hasTrailer: true });
    expect(r).toMatchObject({ availability: Availability.UNAVAILABLE, reason: "catalog", sources: [] });
    expect(JSON.stringify(warn.mock.calls)).not.toMatch(/https?:/); // diagnostics carry no URLs
  });
  test("loaded catalogue: listed title is full, unlisted title falls back to trailer/none", async () => {
    const { resolve } = load();
    global.fetch = jest.fn().mockResolvedValue(jsonResponse(goodCatalog));
    expect((await resolve.resolvePlayback(603)).availability).toBe(Availability.FULL);
    expect((await resolve.resolvePlayback(1, { hasTrailer: true })).availability).toBe(Availability.TRAILER_ONLY);
    expect((await resolve.resolvePlayback(1)).availability).toBe(Availability.NONE);
  });
  test("an entry whose sources all fail validation is 'invalid'", async () => {
    const { resolve } = load();
    global.fetch = jest.fn().mockResolvedValue(jsonResponse({ version: 1, titles: { 7: { status: "available", sources: [{ src: "http://insecure.example.com/a.mp4", type: "mp4" }] } } }));
    expect(await resolve.resolvePlayback(7)).toMatchObject({ availability: Availability.UNAVAILABLE, reason: "invalid" });
  });
  test("malformed playback settings block playback with reason 'config' and never fetch", async () => {
    const { resolve } = load({ REACT_APP_PLAYBACK_RESOLVER_URL: "javascript:alert(1)" });
    global.fetch = jest.fn();
    expect(await resolve.resolvePlayback(603)).toMatchObject({ availability: Availability.UNAVAILABLE, reason: "config" });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  describe("with a resolver", () => {
    const env = { REACT_APP_PLAYBACK_RESOLVER_URL: "https://resolver.example.com/api/" };
    const entry = { status: "available", sources: [{ src: "https://cdn.example.com/a.m3u8", type: "hls" }] };
    test("calls {url}/{id} (trailing slash trimmed) and returns validated sources", async () => {
      const { resolve } = load(env);
      global.fetch = jest.fn().mockResolvedValue(jsonResponse(entry));
      const r = await resolve.resolvePlayback(603);
      expect(global.fetch.mock.calls[0][0]).toBe("https://resolver.example.com/api/603");
      expect(r).toMatchObject({ availability: Availability.FULL, sources: [{ type: "hls" }] });
    });
    test.each([
      [404, Availability.NONE, undefined],
      [401, Availability.RESTRICTED, undefined],
      [403, Availability.RESTRICTED, undefined],
      [451, Availability.RESTRICTED, undefined],
      [500, Availability.UNAVAILABLE, "server"],
      [503, Availability.UNAVAILABLE, "server"],
    ])("HTTP %i", async (status, availability, reason) => {
      const { resolve } = load(env);
      global.fetch = jest.fn().mockResolvedValue({ ok: false, status, json: async () => ({}) });
      const r = await resolve.resolvePlayback(603);
      expect(r.availability).toBe(availability);
      expect(r.reason).toBe(reason);
    });
    test("network failure, malformed JSON and foreign bodies are 'unavailable', not 'no source'", async () => {
      const { resolve } = load(env);
      global.fetch = jest.fn().mockRejectedValue(new TypeError("Failed to fetch"));
      expect(await resolve.resolvePlayback(1)).toMatchObject({ availability: Availability.UNAVAILABLE, reason: "network" });
      global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => { throw new SyntaxError("x"); } });
      expect(await resolve.resolvePlayback(2)).toMatchObject({ availability: Availability.UNAVAILABLE, reason: "invalid" });
      global.fetch = jest.fn().mockResolvedValue(jsonResponse("<html>gateway</html>"));
      expect(await resolve.resolvePlayback(3)).toMatchObject({ availability: Availability.UNAVAILABLE, reason: "invalid" });
    });
    test("a resolver that never answers times out instead of hanging the page", async () => {
      jest.useFakeTimers();
      try {
        const { resolve } = load(env);
        global.fetch = jest.fn((_url, { signal }) => new Promise((_ok, fail) => signal.addEventListener("abort", () => fail(new DOMException("aborted", "AbortError")))));
        const pending = resolve.resolvePlayback(603);
        await Promise.resolve(); // let the resolver issue its fetch before time moves
        jest.advanceTimersByTime(resolve.RESOLVER_TIMEOUT_MS + 10);
        expect(await pending).toMatchObject({ availability: Availability.UNAVAILABLE, reason: "timeout" });
      } finally {
        jest.useRealTimers();
      }
    });
    test("an expired entry from the resolver is reported as expired", async () => {
      const { resolve } = load(env);
      global.fetch = jest.fn().mockResolvedValue(jsonResponse({ ...entry, expiresAt: "2020-01-01T00:00:00Z" }));
      expect(await resolve.resolvePlayback(603)).toMatchObject({ availability: Availability.UNAVAILABLE, reason: "expired" });
    });
  });
});

describe("user-facing availability copy", () => {
  test("each reason has distinct, secret-free wording", () => {
    const labels = ["expired", "invalid", "config", "catalog", "timeout", undefined].map((r) => describeAvailability(Availability.UNAVAILABLE, r).label);
    expect(new Set(labels).size).toBe(labels.length);
    for (const r of ["expired", "invalid", "config", "catalog", "timeout"]) expect(JSON.stringify(describeAvailability(Availability.UNAVAILABLE, r))).not.toMatch(/https?:|token|secret/i);
  });
  test("a trailer-only title never reads as streamable", () => {
    expect(describeAvailability(Availability.TRAILER_ONLY).message).toMatch(/isn’t available to stream/);
  });
});

describe("configuration validation", () => {
  test("accepts https, localhost and relative paths; flags everything else by variable name only", () => {
    expect(validateConfig({ REACT_APP_API_KEY: "k", REACT_APP_PLAYBACK_RESOLVER_URL: "https://r.example.com", REACT_APP_PLAYBACK_CATALOG_URL: "/catalog.json" }).errors).toEqual([]);
    expect(validateConfig({ REACT_APP_TMDB_BASE_URL: "http://localhost:4173/tmdb" }).errors).toEqual([]);
    const bad = validateConfig({ REACT_APP_PLAYBACK_RESOLVER_URL: "javascript:alert(1)", REACT_APP_PLAYBACK_CATALOG_URL: "http://cdn.example.com/c.json", REACT_APP_SITE_URL: "/relative", REACT_APP_TMDB_BASE_URL: "https://u:p@x.test" });
    expect(bad.errors).toHaveLength(4);
    expect(JSON.stringify(bad)).not.toMatch(/alert|cdn\.example|u:p/); // names, never values
  });
  test("warns when metadata cannot be loaded", () => {
    expect(validateConfig({}).warnings.join(" ")).toMatch(/metadata/);
  });
});

describe("build-time secret guard (scripts/check-env.js)", () => {
  test("allows the public TMDB key and normal URLs", () => {
    expect(checkEnv.check({ REACT_APP_API_KEY: "abc", REACT_APP_SITE_URL: "https://kleo2006.github.io/movie-app", REACT_APP_PLAYBACK_RESOLVER_URL: "https://r.example.com" })).toEqual([]);
  });
  test("blocks secret-looking names, credentials in URLs, signed query strings and private keys", () => {
    const problems = checkEnv.check({
      REACT_APP_SIGNING_SECRET: "x",
      REACT_APP_PLAYBACK_RESOLVER_URL: "https://user:pw@r.example.com",
      REACT_APP_PLAYBACK_CATALOG_URL: "https://c.example.com/c.json?X-Amz-Signature=abc",
      REACT_APP_NOTE: "-----BEGIN PRIVATE KEY-----",
      NOT_PUBLISHED_TOKEN: "ignored because it is not REACT_APP_*",
    });
    expect(problems).toHaveLength(4);
    expect(problems.join(" ")).not.toMatch(/pw@|abc|BEGIN/); // never echoes values
  });
});

describe("player support helpers", () => {
  test("HTTP status → player error", () => {
    expect(classifyHttpStatus(401)).toBe(PlayerError.EXPIRED);
    expect(classifyHttpStatus(403)).toBe(PlayerError.EXPIRED);
    expect(classifyHttpStatus(410)).toBe(PlayerError.EXPIRED);
    expect(classifyHttpStatus(451)).toBe(PlayerError.RESTRICTED);
    expect(classifyHttpStatus(404)).toBe(PlayerError.SOURCE);
    expect(classifyHttpStatus(502)).toBe(PlayerError.NETWORK);
    expect(classifyHttpStatus(200)).toBeNull();
    expect(classifyHttpStatus(206)).toBeNull();
  });
  test("hls.js errors use the HTTP status first, then the error type", () => {
    const T = { NETWORK_ERROR: "networkError", MEDIA_ERROR: "mediaError" };
    expect(classifyHlsError({ type: "networkError", response: { code: 403 } }, T)).toBe(PlayerError.EXPIRED);
    expect(classifyHlsError({ type: "networkError", response: { code: 451 } }, T)).toBe(PlayerError.RESTRICTED);
    expect(classifyHlsError({ type: "networkError", response: { code: 503 } }, T)).toBe(PlayerError.NETWORK);
    expect(classifyHlsError({ type: "networkError" }, T)).toBe(PlayerError.NETWORK);
    expect(classifyHlsError({ type: "mediaError" }, T)).toBe(PlayerError.DECODE);
    expect(classifyHlsError({ type: "otherError" }, T)).toBe(PlayerError.UNKNOWN);
  });
  test("probeSourceStatus asks the host with a one-byte ranged GET and tolerates failures", async () => {
    const fetchImpl = jest.fn().mockResolvedValue({ status: 403, body: { cancel: jest.fn() } });
    expect(await probeSourceStatus("/media/a.mp4", { fetchImpl })).toBe(PlayerError.EXPIRED);
    expect(fetchImpl.mock.calls[0][1]).toMatchObject({ method: "GET", headers: { Range: "bytes=0-0" } });
    expect(await probeSourceStatus("/x", { fetchImpl: jest.fn().mockRejectedValue(new TypeError("CORS")) })).toBeNull(); // cross-origin without CORS: no verdict
    expect(await probeSourceStatus("/x", { fetchImpl: jest.fn().mockResolvedValue({ status: 206 }) })).toBeNull();
    expect(await probeSourceStatus("/x", { fetchImpl: null })).toBeNull();
  });
  test("a source that declares codecs is checked against them, not just its container", () => {
    const base = { nativeHls: false, mse: false, mp4: true, webm: true };
    const sources = [{ src: "a.mp4", type: "mp4", codecs: "avc1.64001E, mp4a.40.2" }, { src: "b.webm", type: "webm", codecs: "vp9, opus" }];
    const noH264 = { ...base, canPlay: (t) => !/avc1/.test(t) };
    expect(pickSource(sources, noH264)).toMatchObject({ src: "b.webm" });
    expect(pickSource(sources, { ...base, canPlay: () => true })).toMatchObject({ src: "a.mp4" });
    expect(pickSource(sources, { ...base, canPlay: () => false })).toBeNull();
    // Sources without codecs behave exactly as before.
    expect(pickSource([{ src: "c.mp4", type: "mp4" }], noH264)).toMatchObject({ src: "c.mp4" });
  });
});
