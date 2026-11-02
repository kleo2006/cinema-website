import { ApiError, ErrorKind } from "./errors";
import { normalizeDetails, normalizePage } from "./normalize";
import { config } from "../config";

/**
 * Single entry point for movie metadata (TMDB). Metadata only — whether a film can
 * be *watched* is decided separately in src/playback.
 *
 * Note: any key shipped to a static site is readable by visitors. To keep the key
 * private, point REACT_APP_TMDB_BASE_URL at a small proxy that adds it server-side
 * (see README) and leave REACT_APP_API_KEY unset.
 */
const API_KEY = process.env.REACT_APP_API_KEY;
const HAS_PROXY = Boolean(process.env.REACT_APP_TMDB_BASE_URL); // captured at load, like every other setting
const BASE_URL = (process.env.REACT_APP_TMDB_BASE_URL || "https://api.themoviedb.org/3").replace(/\/$/, "");
const TTL_MS = 5 * 60 * 1000;

const cache = new Map(); // url -> { promise, at }

export function clearApiCache() {
  cache.clear();
}

function buildUrl(path, params) {
  // A relative proxy path ("/tmdb") resolves against the current origin.
  const url = new URL(`${BASE_URL}${path}`, window.location.href);
  url.searchParams.set("language", "en-US");
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  });
  if (API_KEY) url.searchParams.set("api_key", API_KEY);
  return url;
}

async function fetchJson(url) {
  let res;
  try {
    res = await fetch(url);
  } catch {
    throw new ApiError(ErrorKind.NETWORK, "Network request failed");
  }
  if (res.ok) {
    try {
      return await res.json();
    } catch {
      throw new ApiError(ErrorKind.UNKNOWN, "Invalid response");
    }
  }
  if (res.status === 401) throw new ApiError(ErrorKind.AUTH, "Unauthorized", { status: 401 });
  if (res.status === 404) throw new ApiError(ErrorKind.NOT_FOUND, "Not found", { status: 404 });
  if (res.status === 429) {
    throw new ApiError(ErrorKind.RATE_LIMIT, "Rate limited", { status: 429, retryAfter: Number(res.headers.get("retry-after")) || undefined });
  }
  if (res.status >= 500) throw new ApiError(ErrorKind.SERVER, "Server error", { status: res.status });
  throw new ApiError(ErrorKind.UNKNOWN, `Unexpected status ${res.status}`, { status: res.status });
}

/** GET with a short-lived cache. Concurrent identical calls share one network request. */
function request(path, params) {
  // A malformed proxy URL is never contacted: the API key would be sent to it.
  if (!config.metadataConfigOk || (!API_KEY && !HAS_PROXY)) {
    return Promise.reject(new ApiError(ErrorKind.CONFIG, "Missing API key"));
  }
  const url = buildUrl(path, params);
  const key = url.toString();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.promise;
  const promise = fetchJson(url);
  cache.set(key, { promise, at: Date.now() });
  promise.catch(() => cache.delete(key)); // never cache failures
  return promise;
}

export const LIST_CATEGORIES = Object.freeze({
  trending: { path: "/trending/movie/week", title: "Trending this week", slug: "trending" },
  popular: { path: "/movie/popular", title: "Popular", slug: "popular" },
  "top-rated": { path: "/movie/top_rated", title: "Top rated", slug: "top-rated" },
  upcoming: { path: "/movie/upcoming", title: "Upcoming", slug: "upcoming" },
  "now-playing": { path: "/movie/now_playing", title: "In theatres", slug: "now-playing" },
});

export async function getList(category, page = 1) {
  const def = LIST_CATEGORIES[category];
  if (!def) throw new ApiError(ErrorKind.NOT_FOUND, "Unknown category");
  return normalizePage(await request(def.path, { page }));
}

export const SORT_OPTIONS = Object.freeze([
  { value: "popularity.desc", label: "Most popular" },
  { value: "vote_average.desc", label: "Highest rated" },
  { value: "primary_release_date.desc", label: "Newest first" },
  { value: "primary_release_date.asc", label: "Oldest first" },
  { value: "title.asc", label: "Title A to Z" },
]);

const today = () => new Date().toISOString().slice(0, 10);

/** Discover with filters. All params map to documented TMDB /discover/movie options. */
export async function discoverMovies({ genre, year, minRating, status, sort = "popularity.desc", page = 1 } = {}) {
  const params = {
    page,
    sort_by: sort,
    include_adult: false,
    with_genres: genre,
    primary_release_year: year,
    "vote_average.gte": minRating,
    // Sorting by rating is meaningless for titles with a handful of votes.
    "vote_count.gte": sort === "vote_average.desc" ? 300 : minRating ? 50 : undefined,
  };
  if (status === "released") params["primary_release_date.lte"] = today();
  if (status === "upcoming") params["primary_release_date.gte"] = today();
  return normalizePage(await request("/discover/movie", params));
}

export async function searchMovies(query, page = 1) {
  const q = (query || "").trim();
  if (!q) return { results: [], page: 1, totalPages: 0, totalResults: 0 };
  return normalizePage(await request("/search/movie", { query: q, page, include_adult: false }));
}

export async function getGenres() {
  const data = await request("/genre/movie/list");
  return (data.genres || []).filter((g) => g && Number.isInteger(g.id) && g.name);
}

/** One request returns details, credits, videos and related titles. */
export async function getMovie(id) {
  const details = normalizeDetails(await request(`/movie/${id}`, { append_to_response: "videos,credits,recommendations,similar" }));
  if (!details) throw new ApiError(ErrorKind.UNKNOWN, "Malformed movie");
  return details;
}

/** Summary lookup used to render catalogue titles (details request without extras). */
export async function getMovieSummary(id) {
  const raw = await request(`/movie/${id}`);
  return normalizeDetails(raw);
}
