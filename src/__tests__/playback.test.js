/* eslint-disable no-script-url -- javascript: URLs are deliberately used as hostile test input */
import { Availability } from "../playback/availability";
import { isSafeUrl, validateCatalog, validateEntry } from "../playback/catalog";
import { _fromEntry } from "../playback/resolve";
import { PlayerError, classifyMediaError, detectSupport, isRetryable, pickSource, startPosition, describePlayerError } from "../playback/support";

const NOW = Date.parse("2026-01-01T00:00:00Z");
const entry = (over = {}) => validateEntry({ status: "available", sources: [{ src: "https://cdn.example.com/a.mp4", type: "mp4" }], ...over });

describe("availability resolution", () => {
  test("no catalogue entry: a trailer never makes a film playable", () => {
    expect(_fromEntry(undefined, true).availability).toBe(Availability.TRAILER_ONLY);
    expect(_fromEntry(undefined, false).availability).toBe(Availability.NONE);
    expect(_fromEntry(undefined, true).sources).toEqual([]);
  });
  test("valid entry is full, and carries sources", () => {
    const r = _fromEntry(entry(), false, NOW);
    expect(r.availability).toBe(Availability.FULL);
    expect(r.sources).toHaveLength(1);
  });
  test("expired, unavailable, restricted and source-less entries are not playable", () => {
    expect(_fromEntry(entry({ expiresAt: "2020-01-01T00:00:00Z" }), true, NOW).availability).toBe(Availability.UNAVAILABLE);
    expect(_fromEntry(entry({ status: "unavailable" }), true, NOW).availability).toBe(Availability.UNAVAILABLE);
    expect(_fromEntry(entry({ status: "restricted" }), true, NOW).availability).toBe(Availability.RESTRICTED);
    expect(_fromEntry(entry({ sources: [] }), true, NOW).availability).toBe(Availability.UNAVAILABLE);
  });
});

describe("catalogue validation", () => {
  test("unsafe and malformed sources are rejected", () => {
    expect(isSafeUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeUrl("data:video/mp4;base64,AAAA")).toBe(false);
    expect(isSafeUrl("http://example.com/a.mp4")).toBe(false);
    expect(isSafeUrl("//evil.example/a.mp4")).toBe(false);
    expect(isSafeUrl("http://localhost:4010/a.mp4")).toBe(true);
    expect(isSafeUrl("https://cdn.example.com/a.mp4")).toBe(true);
    expect(isSafeUrl("/media/a.mp4")).toBe(true);
    const e = validateEntry({ sources: [{ src: "javascript:x", type: "mp4" }, { src: "https://x.test/a", type: "avi" }, { src: "https://x.test/ok.m3u8", type: "hls" }] });
    expect(e.sources).toEqual([{ src: "https://x.test/ok.m3u8", type: "hls" }]);
  });
  test("catalogue ignores bad ids and garbage input", () => {
    const c = validateCatalog({ titles: { "603": { sources: [{ src: "https://x.test/a.mp4", type: "mp4" }] }, "../x": {}, abc: {} } });
    expect([...c.keys()]).toEqual([603]);
    expect(validateCatalog(null).size).toBe(0);
    expect(validateCatalog("nope").size).toBe(0);
  });
  test("licence links must be https", () => {
    expect(validateEntry({ sources: [], license: { name: "CC", url: "javascript:1" } }).license.url).toBeNull();
  });
});

describe("player support logic", () => {
  const support = (o) => ({ nativeHls: false, mse: false, mp4: false, webm: false, ...o });
  test("picks the first source the browser can play, in the owner's order", () => {
    const sources = [{ src: "a", type: "hls" }, { src: "b", type: "mp4" }];
    expect(pickSource(sources, support({ mp4: true }))).toMatchObject({ src: "b" });
    expect(pickSource(sources, support({ mse: true, mp4: true }))).toMatchObject({ src: "a", native: false });
    expect(pickSource(sources, support({ nativeHls: true }))).toMatchObject({ src: "a", native: true });
    expect(pickSource(sources, support({}))).toBeNull();
  });
  test("detectSupport reads canPlayType", () => {
    const video = { canPlayType: (t) => (t === "video/webm" ? "probably" : "") };
    expect(detectSupport(video, {})).toMatchObject({ webm: true, mp4: false, nativeHls: false, mse: false });
  });
  test("permanent errors are never retried; transient ones are, up to a cap", () => {
    expect(isRetryable(PlayerError.UNSUPPORTED, 0)).toBe(false);
    expect(isRetryable(PlayerError.DECODE, 0)).toBe(false);
    expect(isRetryable(PlayerError.RESTRICTED, 0)).toBe(false);
    expect(isRetryable(PlayerError.NETWORK, 0)).toBe(true);
    expect(isRetryable(PlayerError.NETWORK, 3)).toBe(false);
    expect(isRetryable(PlayerError.EXPIRED, 0)).toBe(false);
    expect(isRetryable(PlayerError.EXPIRED, 0, { canRefresh: true })).toBe(true);
  });
  test("media error mapping; aborts are not failures", () => {
    expect(classifyMediaError({ code: 1 })).toBeNull();
    expect(classifyMediaError({ code: 2 })).toBe(PlayerError.NETWORK);
    expect(classifyMediaError({ code: 3 })).toBe(PlayerError.DECODE);
    expect(classifyMediaError({ code: 4 })).toBe(PlayerError.SOURCE);
  });
  test("error copy never leaks URLs or internals", () => {
    for (const k of Object.values(PlayerError)) expect(JSON.stringify(describePlayerError(k))).not.toMatch(/https?:|stack|token/i);
  });
  test("startPosition ignores invalid or end-of-film positions", () => {
    expect(startPosition(100, 7200)).toBe(100);
    expect(startPosition(7199, 7200)).toBe(0);
    expect(startPosition(-5, 7200)).toBe(0);
    expect(startPosition(NaN, 7200)).toBe(0);
    expect(startPosition(100, NaN)).toBe(100);
  });
});
