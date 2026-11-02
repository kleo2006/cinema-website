import { Availability } from "./availability";
import { CatalogError, loadCatalog, validateEntry } from "./catalog";
import { config } from "../config";

/**
 * Turns "we want to play film N" into a verified decision.
 * Returns { availability, reason?, sources, subtitles, license, expiresAt }.
 *
 * `reason` explains an UNAVAILABLE outcome without leaking anything: "expired" | "invalid" | "config" | "catalog" |
 * "network" | "server" | "timeout". `hasTrailer` only decides between TRAILER_ONLY and NONE; it never makes a film playable.
 * "Can't tell" (catalogue or resolver unreachable, malformed answers, bad settings) is always UNAVAILABLE and never
 * falls back to TRAILER_ONLY/NONE, because those two claim to know that no film is configured.
 */
const outcome = (availability, extra = {}) => ({ availability, sources: [], subtitles: [], license: null, expiresAt: null, ...extra });

export const RESOLVER_TIMEOUT_MS = 10000;

function fromEntry(entry, hasTrailer, now = Date.now()) {
  const fallback = hasTrailer ? Availability.TRAILER_ONLY : Availability.NONE;
  if (!entry) return outcome(fallback);
  if (entry.status === "restricted") return outcome(Availability.RESTRICTED);
  if (entry.expiresAt && entry.expiresAt <= now) return outcome(Availability.UNAVAILABLE, { reason: "expired" });
  if (entry.status === "unavailable") return outcome(Availability.UNAVAILABLE);
  if (!entry.sources.length) return outcome(Availability.UNAVAILABLE, entry.rejectedSources > 0 ? { reason: "invalid" } : {});
  return outcome(Availability.FULL, { sources: entry.sources, subtitles: entry.subtitles, license: entry.license, expiresAt: entry.expiresAt });
}

/** A resolver answer must look like a catalogue entry; HTML from a gateway or an unrelated JSON body is "invalid". */
const looksLikeEntry = (raw) => raw !== null && typeof raw === "object" && !Array.isArray(raw) && (typeof raw.status === "string" || Array.isArray(raw.sources));

async function fromResolver(id, hasTrailer) {
  const controller = typeof AbortController === "undefined" ? null : new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller?.abort();
  }, RESOLVER_TIMEOUT_MS);
  try {
    let res;
    try {
      res = await fetch(`${config.resolverUrl}/${id}`, { headers: { Accept: "application/json" }, cache: "no-store", signal: controller?.signal });
    } catch {
      return outcome(Availability.UNAVAILABLE, { reason: timedOut ? "timeout" : "network" });
    }
    if (res.status === 404) return outcome(hasTrailer ? Availability.TRAILER_ONLY : Availability.NONE);
    if (res.status === 401 || res.status === 403 || res.status === 451) return outcome(Availability.RESTRICTED);
    if (!res.ok) return outcome(Availability.UNAVAILABLE, { reason: "server" });
    let body;
    try {
      body = await res.json();
    } catch {
      return outcome(Availability.UNAVAILABLE, { reason: timedOut ? "timeout" : "invalid" });
    }
    if (!looksLikeEntry(body)) return outcome(Availability.UNAVAILABLE, { reason: "invalid" });
    return fromEntry(validateEntry(body), hasTrailer);
  } finally {
    clearTimeout(timer);
  }
}

export async function resolvePlayback(id, { hasTrailer = false } = {}) {
  if (!config.playbackConfigOk) {
    // Names only; the offending values are never printed.
    console.warn(`[playback] blocked: ${config.configErrors.filter((e) => e.playback).map((e) => e.name).join(", ")} is malformed`);
    return outcome(Availability.UNAVAILABLE, { reason: "config" });
  }
  if (config.resolverUrl) return fromResolver(id, hasTrailer);
  let catalog;
  try {
    catalog = await loadCatalog();
  } catch (error) {
    console.warn(`[playback] catalogue could not be loaded (${error instanceof CatalogError ? error.reason : "unexpected"})`);
    return outcome(Availability.UNAVAILABLE, { reason: "catalog" });
  }
  return fromEntry(catalog.get(id), hasTrailer);
}

export { fromEntry as _fromEntry };
