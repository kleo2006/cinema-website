import { createStore } from "./storage";

/**
 * Playback progress, stored per movie id on this browser only.
 *
 * Rules that keep the data trustworthy:
 * - Positions must be finite, non-negative and not beyond the known duration.
 * - Near the start (< MIN_RESUME_SECONDS) nothing is worth resuming.
 * - Near the end (>= COMPLETE_RATIO of the film, or within END_BUFFER_SECONDS) the film counts as finished
 *   and its entry is removed, so credits don't leave a film stuck in "Continue watching".
 */
export const MIN_RESUME_SECONDS = 30;
export const COMPLETE_RATIO = 0.95;
export const END_BUFFER_SECONDS = 90;
const MAX_ENTRIES = 60;

const finite = (n) => typeof n === "number" && Number.isFinite(n);

export function isResumable(position, duration) {
  if (!finite(position) || position < MIN_RESUME_SECONDS) return false;
  if (!finite(duration) || duration <= 0) return true; // duration unknown: trust the position
  if (position >= duration) return false;
  return position / duration < COMPLETE_RATIO && duration - position > END_BUFFER_SECONDS;
}

const cleanEntry = (e) => {
  if (!e || !finite(e.position) || e.position < 0) return null;
  const duration = finite(e.duration) && e.duration > 0 ? e.duration : null;
  if (duration && e.position > duration) return null;
  return {
    position: e.position,
    duration,
    updatedAt: finite(e.updatedAt) ? e.updatedAt : 0,
    title: typeof e.title === "string" ? e.title.slice(0, 200) : "",
    posterPath: typeof e.posterPath === "string" ? e.posterPath : null,
    backdropPath: typeof e.backdropPath === "string" ? e.backdropPath : null,
  };
};

export const validateProgress = (data) => {
  if (!data || typeof data !== "object" || Array.isArray(data)) return {};
  const out = {};
  for (const [id, entry] of Object.entries(data)) {
    const c = /^\d+$/.test(id) ? cleanEntry(entry) : null;
    if (c) out[id] = c;
  }
  return out;
};

export const progressStore = createStore({ key: "progress", validate: validateProgress, empty: () => ({}) });

export const useProgress = () => progressStore.useStore();

export const getProgress = (id) => progressStore.get()[String(id)] || null;

/** Persist a position. Invalid or insignificant positions never overwrite useful progress. */
export function saveProgress(movie, position, duration) {
  if (!finite(position) || position < 0) return "ignored";
  const dur = finite(duration) && duration > 0 ? duration : null;
  if (dur && position > dur + 1) return "ignored";
  const all = progressStore.get();
  const key = String(movie.id);

  if (dur && (position / dur >= COMPLETE_RATIO || dur - position <= END_BUFFER_SECONDS)) {
    if (!all[key]) return "ignored";
    const { [key]: _removed, ...rest } = all;
    progressStore.set(rest);
    return "completed";
  }
  if (position < MIN_RESUME_SECONDS) return "ignored";

  const next = {
    ...all,
    [key]: {
      position,
      duration: dur,
      updatedAt: Date.now(),
      title: movie.title || all[key]?.title || "",
      posterPath: movie.posterPath ?? all[key]?.posterPath ?? null,
      backdropPath: movie.backdropPath ?? all[key]?.backdropPath ?? null,
    },
  };
  // Keep the most recent entries only.
  const keys = Object.keys(next);
  if (keys.length > MAX_ENTRIES) {
    keys.sort((a, b) => next[b].updatedAt - next[a].updatedAt).slice(MAX_ENTRIES).forEach((k) => delete next[k]);
  }
  progressStore.set(next);
  return "saved";
}

export function clearProgress(id) {
  const all = progressStore.get();
  const key = String(id);
  if (!all[key]) return;
  const { [key]: _removed, ...rest } = all;
  progressStore.set(rest);
}

/** Resumable entries, most recently watched first. */
export function continueWatchingList(all) {
  return Object.entries(all)
    .filter(([, e]) => isResumable(e.position, e.duration))
    .map(([id, e]) => ({ id: Number(id), ...e }))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}
