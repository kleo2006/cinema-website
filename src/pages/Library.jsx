import React from "react";
import { Link } from "react-router-dom";
import { Library as LibraryIcon } from "lucide-react";
import MovieCard from "../components/MovieCard";
import { EmptyState, ErrorState, GridSkeleton } from "../components/States";
import { useCatalog } from "../context/Catalog";
import { useCatalogMovies } from "../hooks/useCatalogMovies";
import { useDocumentMeta } from "../hooks/useDocumentMeta";

/** Only titles with a configured, authorized full-length source. Nothing here is a trailer. */
export default function Library() {
  useDocumentMeta({ title: "Watch in full", description: "Films you can watch in full on Cinema.", path: "/library" });
  const { status, data, error, reload, ready, count } = useCatalogMovies(60);
  const catalog = useCatalog();
  return (
    <div className="container page-pad">
      <header className="page-head">
        <h1 className="page-title">Watch in full</h1>
        <p className="page-lede">Films with an authorized full-length source. Everything else on Cinema is browse-only, with trailers where available.</p>
      </header>
      {catalog.error && (
        <ErrorState
          error={catalog.error}
          onRetry={catalog.reload}
          title="Couldn’t load the list of films"
          message="Cinema couldn’t read which films can be streamed. Check your connection and try again."
        />
      )}
      {!catalog.error && (!ready || (count > 0 && status === "loading")) && <GridSkeleton count={6} />}
      {ready && !count && (
        <EmptyState icon={LibraryIcon} title="No full films are configured yet" action={<Link to="/discover" className="btn btn-primary">Discover films</Link>}>
          Cinema only streams titles with an authorized source. Once the site owner adds some, they appear here.
        </EmptyState>
      )}
      {ready && count > 0 && status === "error" && <ErrorState error={error} onRetry={reload} />}
      {ready && count > 0 && status === "success" && (
        data.length ? (
          <ul className="poster-grid">
            {data.map((m) => <li key={m.id}><MovieCard movie={m} showWatch /></li>)}
          </ul>
        ) : (
          <EmptyState title="Couldn’t load these films">Try again in a moment.</EmptyState>
        )
      )}
    </div>
  );
}
