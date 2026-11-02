import { createStore } from "./storage";

const MAX_ITEMS = 500;

const clean = (e) => {
  if (!e || !Number.isInteger(e.id) || typeof e.title !== "string") return null;
  return {
    id: e.id,
    title: e.title.slice(0, 200),
    posterPath: typeof e.posterPath === "string" ? e.posterPath : null,
    releaseDate: typeof e.releaseDate === "string" ? e.releaseDate : null,
    voteAverage: Number.isFinite(e.voteAverage) ? e.voteAverage : null,
    addedAt: Number.isFinite(e.addedAt) ? e.addedAt : 0,
  };
};

export const validateWatchlist = (data) => {
  if (!Array.isArray(data)) return [];
  const seen = new Set();
  const out = [];
  for (const entry of data) {
    const c = clean(entry);
    if (c && !seen.has(c.id)) {
      seen.add(c.id);
      out.push(c);
    }
  }
  return out.slice(0, MAX_ITEMS);
};

export const watchlistStore = createStore({ key: "watchlist", validate: validateWatchlist, empty: () => [] });

/** Newest first. */
export const useWatchlist = () => watchlistStore.useStore();

export function toEntry(movie) {
  return clean({
    id: movie.id,
    title: movie.title,
    posterPath: movie.posterPath,
    releaseDate: movie.releaseDate,
    voteAverage: movie.voteAverage,
    addedAt: Date.now(),
  });
}

export const isInWatchlist = (list, id) => list.some((m) => m.id === id);

export function addToWatchlist(movie) {
  const list = watchlistStore.get();
  if (isInWatchlist(list, movie.id)) return false;
  const entry = toEntry(movie);
  if (!entry) return false;
  watchlistStore.set([entry, ...list].slice(0, MAX_ITEMS));
  return true;
}

export function removeFromWatchlist(id) {
  const list = watchlistStore.get();
  if (!isInWatchlist(list, id)) return false;
  watchlistStore.set(list.filter((m) => m.id !== id));
  return true;
}

/** Returns true when the movie is now in the list. */
export function toggleWatchlist(movie) {
  return isInWatchlist(watchlistStore.get(), movie.id) ? (removeFromWatchlist(movie.id), false) : (addToWatchlist(movie), true);
}
