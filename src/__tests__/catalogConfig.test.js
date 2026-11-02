import fs from "fs";
import path from "path";
import { Availability } from "../playback/availability";
import { isSafeUrl, parseCatalog, validateEntry } from "../playback/catalog";
import { _fromEntry as fromEntry } from "../playback/resolve";

const read = (...p) => JSON.parse(fs.readFileSync(path.join(__dirname, "..", "..", ...p), "utf8"));

describe("public/catalog.json (the one place authorized static sources are configured)", () => {
  const catalog = parseCatalog(read("public", "catalog.json"));

  test("parses with the production validator", () => {
    expect(catalog).toBeInstanceOf(Map);
  });

  test("every title that is marked available carries a safe source, a licence name, a holder and an https licence link", () => {
    for (const [id, entry] of catalog) {
      expect(Number.isInteger(id) && id > 0).toBe(true); // key is a TMDB id
      if (entry.status !== "available") continue;
      expect(entry.sources.length).toBeGreaterThan(0);
      expect(entry.rejectedSources).toBe(0); // nothing silently dropped
      entry.sources.forEach((s) => expect(isSafeUrl(s.src)).toBe(true));
      expect(entry.license).toMatchObject({ name: expect.any(String), holder: expect.any(String) });
      expect(isSafeUrl(entry.license.url, { allowRelative: false })).toBe(true);
    }
  });
});

describe("Big Buck Bunny candidate entry (docs/candidates; NOT live until verified)", () => {
  const raw = read("docs", "candidates", "bigbuckbunny.catalog-entry.json");
  const catalog = parseCatalog(raw);
  const entry = catalog.get(10378);

  test("is keyed by Big Buck Bunny's TMDB id and by nothing else", () => {
    expect([...catalog.keys()]).toEqual([10378]);
    expect(catalog.get(10379)).toBeUndefined();
  });

  test("has an https MP4 source on the Blender Foundation host, with nothing dropped by validation", () => {
    expect(entry.rejectedSources).toBe(0);
    expect(entry.sources).toHaveLength(1);
    expect(entry.sources[0]).toMatchObject({ type: "mp4" });
    expect(new URL(entry.sources[0].src).protocol).toBe("https:");
    expect(new URL(entry.sources[0].src).hostname).toBe("download.blender.org");
  });

  test("carries the required Creative Commons licence metadata", () => {
    expect(entry.license).toEqual({ name: "CC BY 3.0", holder: "Blender Foundation | www.blender.org", url: "https://creativecommons.org/licenses/by/3.0/" });
  });

  test("resolves to full-film playback, whether or not a trailer exists", () => {
    expect(fromEntry(entry, true).availability).toBe(Availability.FULL);
    expect(fromEntry(entry, false).availability).toBe(Availability.FULL);
    expect(fromEntry(entry, true).license.name).toBe("CC BY 3.0");
  });

  test("a trailer alone never makes a film playable: an unlisted title is trailer-only or not streaming", () => {
    expect(fromEntry(catalog.get(603), true).availability).toBe(Availability.TRAILER_ONLY);
    expect(fromEntry(catalog.get(603), false).availability).toBe(Availability.NONE);
  });

  test("the same entry with an unsafe or unsupported source is refused, not played", () => {
    const withSrc = (src, type = "mp4") => validateEntry({ ...raw.titles["10378"], sources: [{ src, type }] });
    expect(fromEntry(withSrc("http://download.blender.org/a.mp4"), true)).toMatchObject({ availability: Availability.UNAVAILABLE, reason: "invalid" });
    expect(fromEntry(withSrc("javascript:alert(1)"), true)).toMatchObject({ availability: Availability.UNAVAILABLE, reason: "invalid" });
    expect(fromEntry(withSrc("https://download.blender.org/a.avi", "avi"), true)).toMatchObject({ availability: Availability.UNAVAILABLE, reason: "invalid" });
  });

  test("a withdrawn or expired entry is reported as such", () => {
    expect(fromEntry(validateEntry({ ...raw.titles["10378"], status: "unavailable" }), true).availability).toBe(Availability.UNAVAILABLE);
    expect(fromEntry(validateEntry({ ...raw.titles["10378"], expiresAt: "2000-01-01T00:00:00Z" }), true)).toMatchObject({ reason: "expired" });
  });
});
