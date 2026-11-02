import { useAsync } from "./useAsync";
import { resolvePlayback } from "../playback/resolve";

/** Resolves whether (and from where) a film can be watched in full. Re-runs when `movie` changes. */
export function usePlayback(movie) {
  return useAsync(() => (movie ? resolvePlayback(movie.id, { hasTrailer: Boolean(movie.trailer) }) : Promise.resolve(null)), [movie?.id, Boolean(movie?.trailer)]);
}
