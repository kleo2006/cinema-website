import React, { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { X } from "lucide-react";
import PagedGrid from "../components/PagedGrid";
import { EmptyState } from "../components/States";
import { SORT_OPTIONS, discoverMovies } from "../api/tmdb";
import { useGenres } from "../context/Genres";
import { useDocumentMeta } from "../hooks/useDocumentMeta";
import { formatCount } from "../lib/format";

const RATINGS = [
  { value: "", label: "Any rating" },
  { value: "6", label: "6.0 and up" },
  { value: "7", label: "7.0 and up" },
  { value: "8", label: "8.0 and up" },
];
const STATUSES = [
  { value: "", label: "All releases" },
  { value: "released", label: "Already released" },
  { value: "upcoming", label: "Coming soon" },
];
const FIRST_YEAR = 1950;
const DEFAULT_SORT = SORT_OPTIONS[0].value;

/** Reads filters from the URL and ignores anything that isn't a valid value, so shared links can't break the page. */
export function readFilters(params) {
  const genre = /^\d{1,6}$/.test(params.get("genre") || "") ? params.get("genre") : "";
  const year = /^\d{4}$/.test(params.get("year") || "") ? params.get("year") : "";
  const rating = RATINGS.some((r) => r.value && r.value === params.get("rating")) ? params.get("rating") : "";
  const status = STATUSES.some((s) => s.value && s.value === params.get("status")) ? params.get("status") : "";
  const sort = SORT_OPTIONS.some((s) => s.value === params.get("sort")) ? params.get("sort") : DEFAULT_SORT;
  return { genre, year, rating, status, sort };
}

export default function Discover() {
  const [params, setParams] = useSearchParams();
  const { list: genres } = useGenres();
  const filters = readFilters(params);
  const [total, setTotal] = useState(null);
  const genreName = genres.find((g) => String(g.id) === filters.genre)?.name;

  useDocumentMeta({
    title: genreName ? `${genreName} films` : "Discover films",
    description: "Filter films by genre, year, rating and release status, and sort by popularity, rating or date.",
    path: "/discover",
    noindex: Boolean(params.toString()),
  });

  const years = useMemo(() => {
    const next = new Date().getFullYear() + 1;
    return Array.from({ length: next - FIRST_YEAR + 1 }, (_, i) => String(next - i));
  }, []);

  const set = (key, value) => {
    const next = new URLSearchParams(params);
    if (value && !(key === "sort" && value === DEFAULT_SORT)) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };
  const active = Object.entries(filters).filter(([k, v]) => v && !(k === "sort" && v === DEFAULT_SORT)).length;
  const clear = () => setParams(new URLSearchParams(), { replace: true });
  const resetKey = JSON.stringify(filters);

  return (
    <div className="container page-pad">
      <header className="page-head">
        <h1 className="page-title">{genreName ? genreName : "Discover"}</h1>
        <p className="page-lede">Combine filters to narrow the catalogue. Every change is reflected in the address, so you can share a view.</p>
      </header>

      <form className="filters" role="search" aria-label="Filter films" onSubmit={(e) => e.preventDefault()}>
        <div className="field">
          <label htmlFor="f-genre">Genre</label>
          <select id="f-genre" className="select" value={filters.genre} onChange={(e) => set("genre", e.target.value)}>
            <option value="">All genres</option>
            {genres.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="f-year">Release year</label>
          <select id="f-year" className="select" value={filters.year} onChange={(e) => set("year", e.target.value)}>
            <option value="">Any year</option>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="f-rating">Rating</label>
          <select id="f-rating" className="select" value={filters.rating} onChange={(e) => set("rating", e.target.value)}>
            {RATINGS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="f-status">Release status</label>
          <select id="f-status" className="select" value={filters.status} onChange={(e) => set("status", e.target.value)}>
            {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="f-sort">Sort by</label>
          <select id="f-sort" className="select" value={filters.sort} onChange={(e) => set("sort", e.target.value)}>
            {SORT_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <button type="button" className="btn btn-ghost filters-clear" onClick={clear} disabled={!active}>
          <X size={16} aria-hidden="true" />
          Clear filters{active ? ` (${active})` : ""}
        </button>
      </form>

      <p className="result-count" role="status" aria-live="polite">
        {total != null ? `${formatCount(total)} ${total === 1 ? "film" : "films"}` : " "}
      </p>

      <PagedGrid
        resetKey={resetKey}
        onTotal={setTotal}
        fetchPage={(page) => discoverMovies({ ...filters, genre: filters.genre || undefined, year: filters.year || undefined, minRating: filters.rating || undefined, status: filters.status || undefined, page })}
        empty={
          <EmptyState title="No films match these filters" action={active ? <button type="button" className="btn btn-primary" onClick={clear}>Clear filters</button> : null}>
            Try widening the year or lowering the minimum rating.
          </EmptyState>
        }
      />
    </div>
  );
}
