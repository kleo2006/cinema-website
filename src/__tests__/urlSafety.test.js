/* eslint-disable no-script-url -- hostile URLs are deliberate test input */
import { isSafeUrl } from "../lib/url";
import { validateEntry } from "../playback/catalog";

describe("isSafeUrl", () => {
  test.each([
    ["https://cdn.example.com/a.mp4", true],
    ["http://localhost:4173/a.mp4", true],
    ["http://127.0.0.1/a.mp4", true],
    ["/media/a.mp4", true],
    ["http://cdn.example.com/a.mp4", false],
    ["javascript:alert(1)", false],
    ["data:video/mp4;base64,AAAA", false],
    ["blob:https://x.test/uuid", false],
    ["file:///etc/passwd", false],
    ["//evil.example/a.mp4", false],
    ["https://user:pass@cdn.example.com/a.mp4", false],
    ["https://user@cdn.example.com/a.mp4", false],
    ["", false],
    ["   ", false],
    [null, false],
    [42, false],
  ])("%s → %s", (value, expected) => expect(isSafeUrl(value)).toBe(expected));

  test("a backslash cannot turn a same-origin path into another origin (browsers read /\\host as //host)", () => {
    expect(isSafeUrl("/\\evil.example/a.mp4")).toBe(false);
    expect(isSafeUrl("https://cdn.example.com\\@evil.example/a.mp4")).toBe(false);
  });

  test("control characters are refused", () => {
    expect(isSafeUrl("/media/a\n.mp4")).toBe(false);
    expect(isSafeUrl("/media/a\u0000.mp4")).toBe(false);
    expect(isSafeUrl("https://cdn.example.com/a\t.mp4")).toBe(false);
  });

  test("relative paths can be disallowed (licence links, site URL)", () => {
    expect(isSafeUrl("/terms", { allowRelative: false })).toBe(false);
    expect(isSafeUrl("https://example.com/terms", { allowRelative: false })).toBe(true);
  });

  test("catalogue sources and subtitles go through the same check", () => {
    const e = validateEntry({
      sources: [{ src: "/\\evil.example/a.mp4", type: "mp4" }, { src: "https://cdn.example.com/ok.mp4", type: "mp4" }],
      subtitles: [{ src: "/\\evil.example/en.vtt", lang: "en", label: "English" }],
    });
    expect(e.sources.map((s) => s.src)).toEqual(["https://cdn.example.com/ok.mp4"]);
    expect(e.rejectedSources).toBe(1);
    expect(e.subtitles).toEqual([]);
  });
});
