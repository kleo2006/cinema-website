import { config } from "../config";
import { isSafeUrl } from "../lib/url";

export { isSafeUrl };

/**
 * The catalogue lists titles for which an authorized full-length source exists.
 * Shape (see docs/STREAMING.md):
 * {
 *   "version": 1,
 *   "titles": {
 *     "<tmdbId>": {
 *       "status": "available" | "unavailable" | "restricted",
 *       "sources": [{ "src": "https://…", "type": "hls" | "mp4" | "webm" }],
 *       "subtitles": [{ "src": "https://….vtt", "lang": "en", "label": "English" }],
 *       "license": { "name": "CC BY 3.0", "holder": "…", "url": "https://…" },
 *       "expiresAt": "2030-01-01T00:00:00Z"
 *     }
 *   }
 * }
 */
const TYPES = new Set(["hls", "mp4", "webm"]);
const STATUSES = new Set(["available", "unavailable", "restricted"]);

const text = (v, max = 200) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

/** The MIME types a declared `type` may carry. `mime` is optional, but when present it must agree with `type`. */
const MIME_FOR_TYPE = {
  mp4: ["video/mp4"],
  webm: ["video/webm"],
  hls: ["application/vnd.apple.mpegurl", "application/x-mpegurl"],
};
/** RFC 6381-style list such as `avc1.64001E, mp4a.40.2` or `vp9, opus`. Anything that could break out of a quoted MIME parameter is refused. */
const CODEC_LIST = /^[A-Za-z0-9]+(\.[A-Za-z0-9-]+)*(\s*,\s*[A-Za-z0-9]+(\.[A-Za-z0-9-]+)*)*$/;

function validateSource(s) {
  if (!s || typeof s !== "object" || !TYPES.has(s.type) || !isSafeUrl(s.src)) return null;
  const out = { src: s.src, type: s.type };
  if (s.mime !== undefined && s.mime !== null) {
    if (typeof s.mime !== "string" || !MIME_FOR_TYPE[s.type].includes(s.mime.split(";")[0].trim().toLowerCase())) return null;
    out.mime = s.mime.trim().slice(0, 120);
  }
  if (s.codecs !== undefined && s.codecs !== null) {
    if (typeof s.codecs !== "string" || s.codecs.length > 100 || !CODEC_LIST.test(s.codecs.trim())) return null;
    out.codecs = s.codecs.trim();
  }
  return out;
}

export function validateSources(list) {
  return Array.isArray(list) ? list.map(validateSource).filter(Boolean) : [];
}

export function validateEntry(raw) {
  if (!raw || typeof raw !== "object") return null;
  const sources = validateSources(raw.sources);
  const rejectedSources = Array.isArray(raw.sources) ? raw.sources.length - sources.length : 0;
  const status = STATUSES.has(raw.status) ? raw.status : sources.length ? "available" : "unavailable";
  const expires = raw.expiresAt ? Date.parse(raw.expiresAt) : NaN;
  const license = raw.license && typeof raw.license === "object"
    ? {
        name: text(raw.license.name),
        holder: text(raw.license.holder),
        url: isSafeUrl(raw.license.url, { allowRelative: false }) ? raw.license.url : null,
      }
    : null;
  return {
    status,
    sources,
    rejectedSources,
    subtitles: (Array.isArray(raw.subtitles) ? raw.subtitles : [])
      .filter((t) => t && isSafeUrl(t.src) && text(t.lang, 12) && text(t.label, 40))
      .map((t) => ({ src: t.src, lang: text(t.lang, 12), label: text(t.label, 40) })),
    license: license && (license.name || license.holder) ? license : null,
    expiresAt: Number.isFinite(expires) ? expires : null,
  };
}

export function validateCatalog(raw) {
  const titles = new Map();
  const source = raw && typeof raw === "object" && raw.titles && typeof raw.titles === "object" ? raw.titles : {};
  for (const [id, value] of Object.entries(source)) {
    if (!/^\d{1,9}$/.test(id)) continue;
    const entry = validateEntry(value);
    if (entry) titles.set(Number(id), entry);
  }
  return titles;
}

/** The catalogue file itself could not be loaded or is not a catalogue. Never shown with URLs or response bodies. */
export class CatalogError extends Error {
  constructor(reason) {
    super(`Catalogue unavailable (${reason})`);
    this.name = "CatalogError";
    this.reason = reason; // "network" | "http" | "json" | "structure" | "timeout"
  }
}

/**
 * Strict form of validateCatalog for a document fetched from the network: it must be `{ "version": 1, "titles": { … } }`
 * (`version` may be omitted, meaning 1; any other version is refused because this code cannot interpret it).
 * An empty `titles` object is a valid, deliberate "nothing is configured"; anything else that is not a catalogue throws,
 * so a broken file can never be mistaken for an empty library.
 */
export function parseCatalog(raw) {
  const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
  if (!isObject(raw) || (raw.version !== undefined && raw.version !== 1) || !isObject(raw.titles)) throw new CatalogError("structure");
  return validateCatalog(raw);
}

export const CATALOG_TIMEOUT_MS = 15000;

let pending = null;

async function fetchCatalog() {
  const controller = typeof AbortController === "undefined" ? null : new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller?.abort();
  }, CATALOG_TIMEOUT_MS);
  try {
    let res;
    try {
      res = await fetch(config.catalogUrl, { headers: { Accept: "application/json" }, signal: controller?.signal });
    } catch {
      throw new CatalogError(timedOut ? "timeout" : "network");
    }
    if (!res.ok) throw new CatalogError("http");
    let body;
    try {
      body = await res.json();
    } catch {
      throw new CatalogError(timedOut ? "timeout" : "json");
    }
    return parseCatalog(body);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Loads the catalogue. A success is cached for the session; a failure rejects with CatalogError and is NOT cached,
 * so the next call retries. (A broken catalogue must read as "can't tell", never as "nothing is playable".)
 */
export function loadCatalog() {
  if (!pending) {
    const attempt = fetchCatalog();
    pending = attempt;
    attempt.catch(() => {
      if (pending === attempt) pending = null;
    });
  }
  return pending;
}

export function resetCatalogCache() {
  pending = null;
}
