import React, { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import PagedGrid from "../components/PagedGrid";
import SearchBox from "../components/SearchBox";
import { EmptyState } from "../components/States";
import { searchMovies } from "../api/tmdb";
import { useDocumentMeta } from "../hooks/useDocumentMeta";
import { formatCount } from "../lib/format";
import { useSearchHistory } from "../store/searchHistory";

export default function Search() {
  const [params] = useSearchParams();
  const q = (params.get("q") || "").trim().slice(0, 100);
  const [total, setTotal] = useState(null);
  const history = useSearchHistory();
  useDocumentMeta({ title: q ? `Search: ${q}` : "Search", description: "Search films by title.", path: "/search", noindex: true });

  return (
    <div className="container page-pad">
      <header className="page-head">
        <h1 className="page-title">{q ? <>Results for <em>“{q}”</em></> : "Search"}</h1>
        <div className="search-page-box">
          <SearchBox autoFocus={!q} />
        </div>
      </header>
      {!q && (
        <EmptyState title="Search by film title">
          Type a title above and press Enter. Suggestions appear as you type.
        </EmptyState>
      )}
      {!q && history.length > 0 && (
        <ul className="chip-row chip-row-center" aria-label="Recent searches">
          {history.map((h) => (
            <li key={h}><Link className="chip" to={`/search?q=${encodeURIComponent(h)}`}>{h}</Link></li>
          ))}
        </ul>
      )}
      {q && (
        <>
          <p className="result-count" role="status" aria-live="polite">
            {total != null ? `${formatCount(total)} ${total === 1 ? "result" : "results"}` : " "}
          </p>
          <PagedGrid
            resetKey={q}
            onTotal={setTotal}
            fetchPage={(page) => searchMovies(q, page)}
            empty={
              <EmptyState title={`No films found for “${q}”`}>
                Check the spelling or try fewer words. You can also <Link className="text-link" to="/discover">browse with filters</Link>.
              </EmptyState>
            }
          />
        </>
      )}
    </div>
  );
}
