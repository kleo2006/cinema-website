const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * The one definition of "a URL this app is willing to load or follow".
 *  - https: anywhere; http: only for localhost development
 *  - same-origin paths ("/media/a.mp4"), unless `allowRelative` is false
 *  - never javascript:, data:, blob:, file:, protocol-relative "//host", or URLs with embedded credentials
 *  - never control characters or backslashes: browsers read "/\host" as "//host", which would leave the origin
 */
export function isSafeUrl(value, { allowRelative = true } = {}) {
  if (typeof value !== "string" || !value.trim()) return false;
  for (const ch of value) {
    const code = ch.charCodeAt(0);
    if (code < 32 || code === 127 || ch === "\\") return false;
  }
  if (allowRelative && value.startsWith("/") && !value.startsWith("//")) return true;
  try {
    const u = new URL(value);
    if (u.username || u.password) return false;
    if (u.protocol === "https:") return true;
    return u.protocol === "http:" && LOCAL_HOSTS.has(u.hostname);
  } catch {
    return false;
  }
}
