import React from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { EmptyState, ErrorState } from "../components/States";
import { useGenres } from "../context/Genres";
import { useDocumentMeta } from "../hooks/useDocumentMeta";

export default function Genres() {
  useDocumentMeta({ title: "Genres", description: "Browse films by genre.", path: "/genres" });
  const { list, status } = useGenres();
  return (
    <div className="container page-pad">
      <header className="page-head">
        <h1 className="page-title">Genres</h1>
        <p className="page-lede">Pick a genre to see its films, then refine by year, rating or release status.</p>
      </header>
      {status === "loading" && <div className="genre-grid" aria-hidden="true">{Array.from({ length: 12 }, (_, i) => <div key={i} className="skeleton genre-skeleton" />)}</div>}
      {status === "error" && <ErrorState error={null} onRetry={() => window.location.reload()} />}
      {status === "ready" && !list.length && <EmptyState title="No genres available" />}
      {status === "ready" && list.length > 0 && (
        <ul className="genre-grid">
          {list.map((g, i) => (
            <li key={g.id}>
              <Link to={`/discover?genre=${g.id}`} className="genre-tile">
                <span className="genre-index" aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
                <span className="genre-name">{g.name}</span>
                <ArrowUpRight size={18} aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
