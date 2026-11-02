import { isSafeUrl } from "./lib/url";

/** All environment-driven settings in one place. Nothing here is a secret that is safe to hide in a browser bundle. */
const PUBLIC_URL = process.env.PUBLIC_URL || "";

/**
 * Read each variable by its full name so the build can inline it (CRA replaces `process.env.REACT_APP_*` statically).
 * Tests load this module with different values, which is why validation runs on this snapshot rather than on `process.env`.
 */
const env = {
  REACT_APP_API_KEY: process.env.REACT_APP_API_KEY,
  REACT_APP_TMDB_BASE_URL: process.env.REACT_APP_TMDB_BASE_URL,
  REACT_APP_PLAYBACK_CATALOG_URL: process.env.REACT_APP_PLAYBACK_CATALOG_URL,
  REACT_APP_PLAYBACK_RESOLVER_URL: process.env.REACT_APP_PLAYBACK_RESOLVER_URL,
  REACT_APP_SITE_URL: process.env.REACT_APP_SITE_URL,
};

// `relative`: a same-origin path is acceptable. `playback`: a bad value makes playback unavailable rather than guessed.
const URL_SETTINGS = [
  { name: "REACT_APP_TMDB_BASE_URL", relative: true, playback: false },
  { name: "REACT_APP_PLAYBACK_CATALOG_URL", relative: true, playback: true },
  { name: "REACT_APP_PLAYBACK_RESOLVER_URL", relative: true, playback: true },
  { name: "REACT_APP_SITE_URL", relative: false, playback: false },
];

/**
 * Checks the public settings. Messages name the variable and never echo its value, so nothing sensitive can reach
 * a log or the UI. Returns { errors: [{ name, message, playback }], warnings: [string] }.
 */
export function validateConfig(values) {
  const errors = [];
  const warnings = [];
  for (const { name, relative, playback } of URL_SETTINGS) {
    const value = values[name];
    if (!value) continue;
    if (!isSafeUrl(value, { allowRelative: relative })) {
      const shape = relative ? "an https:// URL or a path starting with /" : "an absolute https:// URL";
      errors.push({ name, playback, message: `${name} must be ${shape} (http:// is accepted only for localhost) and must not contain a username or password.` });
    }
  }
  if (!values.REACT_APP_API_KEY && !values.REACT_APP_TMDB_BASE_URL) {
    warnings.push("No movie metadata source is configured: set REACT_APP_API_KEY or REACT_APP_TMDB_BASE_URL. Film pages and shelves cannot load without one.");
  }
  return { errors, warnings };
}

const issues = validateConfig(env);

export const config = Object.freeze({
  publicUrl: PUBLIC_URL,
  /** Absolute site URL used for canonical and social metadata. Falls back to the current origin. */
  siteUrl: (env.REACT_APP_SITE_URL || "").replace(/\/$/, ""),
  /** JSON catalogue of titles that have an authorized full-length source. See docs/STREAMING.md. */
  catalogUrl: env.REACT_APP_PLAYBACK_CATALOG_URL || `${PUBLIC_URL}/catalog.json`,
  /** Optional server that returns a (possibly signed) source for one title: GET {url}/{tmdbId}. */
  resolverUrl: (env.REACT_APP_PLAYBACK_RESOLVER_URL || "").replace(/\/$/, ""),
  /** Names of malformed settings. A malformed *playback* setting blocks playback instead of being guessed around. */
  configErrors: issues.errors,
  playbackConfigOk: !issues.errors.some((e) => e.playback),
  /** The metadata host may be sent the API key, so a malformed one must never be contacted. */
  metadataConfigOk: !issues.errors.some((e) => e.name === "REACT_APP_TMDB_BASE_URL"),
});

if (process.env.NODE_ENV !== "test") {
  // Variable names only. Safe to show in the console of a production site.
  issues.errors.forEach((e) => console.error(`[config] ${e.message}`));
  issues.warnings.forEach((w) => console.warn(`[config] ${w}`));
}

export function absoluteUrl(path = "/") {
  const base = config.siteUrl || `${window.location.origin}${PUBLIC_URL}`;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
