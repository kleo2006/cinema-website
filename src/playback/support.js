/**
 * Pure helpers for the player: which source to use, and how to explain a failure.
 * Kept free of React so they can be unit-tested without a browser.
 */
export const PlayerError = Object.freeze({
  UNSUPPORTED: "unsupported", // no listed format can be played by this browser — permanent
  NETWORK: "network", // connection dropped — retrying can help
  EXPIRED: "expired", // the signed URL was refused or has expired — needs a fresh source
  RESTRICTED: "restricted", // the host refuses to serve it — permanent
  DECODE: "decode", // the file is damaged or uses an unsupported codec — permanent
  SOURCE: "source", // the file could not be loaded (missing, moved, blocked)
  UNKNOWN: "unknown",
});

export const MAX_RETRIES = 3;

const HLS_MIME = "application/vnd.apple.mpegurl";

/** What this browser can play. `video` is an HTMLVideoElement (or anything with canPlayType). */
export function detectSupport(video, win = typeof window === "undefined" ? {} : window) {
  const can = (type) => Boolean(video?.canPlayType?.(type));
  return {
    nativeHls: can(HLS_MIME),
    mse: Boolean(win.MediaSource || win.ManagedMediaSource),
    mp4: can("video/mp4"),
    webm: can("video/webm"),
    /** Whether the browser says it can play a full MIME type, including a `codecs=` parameter. */
    canPlay: can,
  };
}

const CONTAINER_MIME = { mp4: "video/mp4", webm: "video/webm" };

/** A source that declares `codecs` is checked against them: "can play MP4" is not "can play this MP4". */
function codecsPlayable(source, support) {
  if (!source.codecs || typeof support.canPlay !== "function") return true;
  const base = (source.mime || CONTAINER_MIME[source.type]).split(";")[0].trim();
  return Boolean(support.canPlay(`${base}; codecs="${source.codecs}"`));
}

/** First listed source this browser can play. Order in the catalogue is the owner's order of preference. */
export function pickSource(sources, support) {
  for (const s of sources || []) {
    if (s.type === "hls" && (support.nativeHls || support.mse)) return { ...s, native: support.nativeHls };
    if (s.type === "mp4" && support.mp4 && codecsPlayable(s, support)) return { ...s, native: true };
    if (s.type === "webm" && support.webm && codecsPlayable(s, support)) return { ...s, native: true };
  }
  return null;
}

/** Whether Retry should be offered. Permanent problems and exhausted attempts never offer it. */
export function isRetryable(kind, attempts, { canRefresh = false } = {}) {
  if (attempts >= MAX_RETRIES) return false;
  if (kind === PlayerError.NETWORK || kind === PlayerError.SOURCE || kind === PlayerError.UNKNOWN) return true;
  if (kind === PlayerError.EXPIRED) return canRefresh;
  return false;
}

/** User-facing copy. Never includes URLs, tokens or stack traces. */
export function describePlayerError(kind) {
  switch (kind) {
    case PlayerError.UNSUPPORTED:
      return { title: "This browser can’t play this film", message: "None of the available video formats are supported here. Try a different browser or device." };
    case PlayerError.NETWORK:
      return { title: "Playback was interrupted", message: "The connection dropped while loading the film. Check your connection and try again." };
    case PlayerError.EXPIRED:
      return { title: "This playback link has expired", message: "Reload the film to get a fresh link." };
    case PlayerError.RESTRICTED:
      return { title: "Playback isn’t allowed", message: "The video provider refused this request. It may be restricted in your region or require access." };
    case PlayerError.DECODE:
      return { title: "The video couldn’t be decoded", message: "The file appears to be damaged or uses a format this device can’t decode." };
    case PlayerError.SOURCE:
      return { title: "The film couldn’t be loaded", message: "The video file is unavailable right now. Try again in a moment." };
    default:
      return { title: "Something went wrong", message: "Playback stopped unexpectedly." };
  }
}

/** Maps HTMLMediaElement.error codes (1 aborted, 2 network, 3 decode, 4 not supported). */
export function classifyMediaError(error) {
  switch (error?.code) {
    case 1:
      return null; // aborted by us (source change or teardown) — not a failure
    case 2:
      return PlayerError.NETWORK;
    case 3:
      return PlayerError.DECODE;
    case 4:
      return PlayerError.SOURCE;
    default:
      return PlayerError.UNKNOWN;
  }
}

/**
 * What an HTTP status from the video host means for playback. null = the host answered normally.
 * 401/403/410 are how signed URLs fail once they expire; 451 is a legal/regional refusal.
 */
export function classifyHttpStatus(status) {
  if (!Number.isFinite(status) || status < 400) return null;
  if (status === 401 || status === 403 || status === 410) return PlayerError.EXPIRED;
  if (status === 451) return PlayerError.RESTRICTED;
  if (status === 408 || status === 429 || status >= 500) return PlayerError.NETWORK;
  return PlayerError.SOURCE; // 404 and other client errors: the file isn't there or can't be read
}

/** hls.js fatal error details → our kinds. The HTTP status wins when there is one; `Hls` supplies the enum values. */
export function classifyHlsError(data, ErrorTypes) {
  const byStatus = classifyHttpStatus(data?.response?.code);
  if (byStatus) return byStatus;
  if (data?.type === ErrorTypes.NETWORK_ERROR) return PlayerError.NETWORK;
  if (data?.type === ErrorTypes.MEDIA_ERROR) return PlayerError.DECODE;
  return PlayerError.UNKNOWN;
}

/**
 * A <video> that fails to load reports only "network" or "not supported", never the HTTP status. To tell an expired
 * link (403) from a missing file (404) we ask the host for a single byte. No verdict (null) is a normal outcome:
 * cross-origin hosts without CORS headers cannot be inspected, and a healthy answer proves nothing about the failure.
 */
export async function probeSourceStatus(url, { fetchImpl = typeof fetch === "function" ? fetch : null, signal } = {}) {
  if (!fetchImpl) return null;
  try {
    const res = await fetchImpl(url, { method: "GET", headers: { Range: "bytes=0-0" }, cache: "no-store", signal });
    res.body?.cancel?.(); // we only wanted the status line; don't download the file
    return classifyHttpStatus(res.status);
  } catch {
    return null;
  }
}

/** Where to start. A position is used only if it is sensible for this film. */
export function startPosition(position, duration, minimum = 0) {
  if (!Number.isFinite(position) || position <= minimum) return 0;
  if (Number.isFinite(duration) && duration > 0 && position >= duration - 5) return 0;
  return position;
}
