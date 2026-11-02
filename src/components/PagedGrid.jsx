import React, { useEffect, useRef, useState } from "react";
import MovieCard from "./MovieCard";
import { ErrorState, GridSkeleton } from "./States";

/**
 * Accumulating grid ("Load more"). `fetchPage(page)` must return { results, totalPages, totalResults }.
 * `resetKey` identifies the query; changing it starts over, and responses from an older query are discarded.
 */
export default function PagedGrid({ fetchPage, resetKey, empty, onTotal }) {
  const [state, setState] = useState({ items: [], page: 0, totalPages: 1, status: "loading", error: null });
  const runId = useRef(0);
  const fetchRef = useRef(fetchPage);
  fetchRef.current = fetchPage;
  const totalRef = useRef(onTotal);
  totalRef.current = onTotal;

  const load = (page, replace) => {
    const run = replace ? ++runId.current : runId.current;
    setState((s) => ({ ...(replace ? { items: [], page: 0, totalPages: 1 } : s), status: replace ? "loading" : "more", error: null }));
    fetchRef.current(page).then(
      (data) => {
        if (run !== runId.current) return;
        totalRef.current?.(data.totalResults);
        setState((s) => {
          const seen = new Set(s.items.map((m) => m.id));
          const fresh = data.results.filter((m) => !seen.has(m.id));
          return { items: [...s.items, ...fresh], page: data.page, totalPages: data.totalPages, status: "ready", error: null };
        });
      },
      (error) => {
        if (run !== runId.current) return;
        setState((s) => ({ ...s, status: "error", error }));
      },
    );
  };

  useEffect(() => {
    load(1, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  const { items, page, totalPages, status, error } = state;
  if (status === "loading") return <GridSkeleton />;
  if (status === "error" && !items.length) return <ErrorState error={error} onRetry={() => load(1, true)} />;
  if (!items.length) return empty;
  const hasMore = page < totalPages;
  return (
    <>
      <ul className="poster-grid">
        {items.map((m, i) => (
          <li key={m.id}>
            <MovieCard movie={m} priority={i < 6} />
          </li>
        ))}
      </ul>
      {status === "error" && <ErrorState error={error} onRetry={() => load(page + 1, false)} />}
      {hasMore && status !== "error" && (
        <div className="load-more">
          <button type="button" className="btn btn-ghost" disabled={status === "more"} onClick={() => load(page + 1, false)}>
            {status === "more" ? "Loading…" : "Load more"}
          </button>
        </div>
      )}
    </>
  );
}
