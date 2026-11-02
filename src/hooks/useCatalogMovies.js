import { useCatalog } from "../context/Catalog";
import { useAsync } from "./useAsync";
import { getMovieSummary } from "../api/tmdb";

/**
 * Metadata for titles that have a configured full-length source. The catalogue only holds ids and
 * sources, so display data (poster, title, year) still comes from the metadata provider.
 */
export function useCatalogMovies(limit = 24) {
  const { ready, ids } = useCatalog();
  const wanted = [...ids].slice(0, limit);
  const key = wanted.join(",");
  const state = useAsync(
    async () => {
      if (!ready || !wanted.length) return [];
      const settled = await Promise.allSettled(wanted.map((id) => getMovieSummary(id)));
      const movies = settled.filter((r) => r.status === "fulfilled" && r.value).map((r) => r.value);
      // If every lookup failed, surface the failure instead of pretending the catalogue is empty.
      if (!movies.length && settled.every((r) => r.status === "rejected")) throw settled[0].reason;
      return movies;
    },
    [ready, key],
  );
  return { ...state, ready, count: ids.size };
}
