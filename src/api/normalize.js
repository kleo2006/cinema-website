/**
 * Converts raw TMDB payloads into the shapes the UI uses.
 * Missing data stays missing (null) — nothing is invented to fill a gap.
 */

const str = (v) => (typeof v === "string" && v.trim() ? v.trim() : null);
const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);

export function normalizeMovie(raw) {
  if (!raw || !Number.isInteger(raw.id)) return null;
  const voteCount = num(raw.vote_count) ?? 0;
  const releaseDate = str(raw.release_date);
  return {
    id: raw.id,
    title: str(raw.title) || str(raw.original_title) || "Untitled",
    overview: str(raw.overview),
    posterPath: str(raw.poster_path),
    backdropPath: str(raw.backdrop_path),
    releaseDate,
    year: releaseDate ? releaseDate.slice(0, 4) : null,
    // A rating from zero votes is not a rating, so it is treated as absent.
    voteAverage: voteCount > 0 ? num(raw.vote_average) : null,
    voteCount,
    genreIds: Array.isArray(raw.genre_ids) ? raw.genre_ids.filter(Number.isInteger) : Array.isArray(raw.genres) ? raw.genres.map((g) => g.id) : [],
    popularity: num(raw.popularity),
  };
}

export function normalizePage(raw) {
  return {
    results: (raw?.results || []).map(normalizeMovie).filter(Boolean),
    page: num(raw?.page) ?? 1,
    totalPages: Math.min(num(raw?.total_pages) ?? 1, 500), // TMDB serves at most 500 pages
    totalResults: num(raw?.total_results) ?? 0,
  };
}

const YOUTUBE_KEY = /^[\w-]{6,20}$/;

export function pickTrailer(videos) {
  const candidates = (videos?.results || []).filter((v) => v.site === "YouTube" && v.type === "Trailer" && YOUTUBE_KEY.test(v.key || ""));
  if (!candidates.length) return null;
  const best = candidates.find((v) => v.official) || candidates[0];
  return { key: best.key, name: str(best.name) || "Trailer" };
}

export function normalizeDetails(raw) {
  const base = normalizeMovie(raw);
  if (!base) return null;
  const crew = raw.credits?.crew || [];
  const similarSource = raw.recommendations?.results?.length ? raw.recommendations : raw.similar;
  return {
    ...base,
    tagline: str(raw.tagline),
    runtime: num(raw.runtime) > 0 ? raw.runtime : null,
    status: str(raw.status),
    genres: (raw.genres || []).filter((g) => g && Number.isInteger(g.id) && g.name),
    director: crew.filter((c) => c.job === "Director").map((c) => c.name).filter(Boolean),
    cast: (raw.credits?.cast || [])
      .slice(0, 14)
      .map((c) => ({ id: c.id, name: str(c.name), character: str(c.character), profilePath: str(c.profile_path) }))
      .filter((c) => c.name),
    productionCompanies: (raw.production_companies || []).map((c) => c.name).filter(Boolean),
    trailer: pickTrailer(raw.videos),
    // "Related" because TMDB's recommendation signal is not personalised to the viewer.
    related: normalizePage(similarSource).results.filter((m) => m.id !== raw.id).slice(0, 18),
  };
}
