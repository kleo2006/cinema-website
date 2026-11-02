import React, { useRef } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import MovieCard from "./MovieCard";
import { ErrorState, RowSkeleton } from "./States";
import { useAsync } from "../hooks/useAsync";
import { useInView } from "../hooks/useInView";

/** Horizontal, scroll-snapping shelf. Scrolls by touch, wheel, keyboard focus, or the arrow buttons. */
export function Shelf({ title, id, movies, seeAll, children }) {
  const track = useRef(null);
  const headingId = `${id}-title`;
  const scrollBy = (dir) => {
    const el = track.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: "smooth" });
  };
  return (
    <section className="section" aria-labelledby={headingId}>
      <div className="section-head">
        <h2 className="section-title" id={headingId}>{title}</h2>
        <div className="section-tools">
          {seeAll && <Link className="section-link" to={seeAll}>See all</Link>}
          <button type="button" className="btn btn-icon btn-ghost row-arrow" onClick={() => scrollBy(-1)} aria-label={`Scroll ${title} left`}>
            <ChevronLeft size={20} aria-hidden="true" />
          </button>
          <button type="button" className="btn btn-icon btn-ghost row-arrow" onClick={() => scrollBy(1)} aria-label={`Scroll ${title} right`}>
            <ChevronRight size={20} aria-hidden="true" />
          </button>
        </div>
      </div>
      {children || (
        <ul className="row-track" ref={track} tabIndex={-1}>
          {movies.map((m) => (
            <li key={m.id} className="row-item">
              <MovieCard movie={m} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** A shelf that fetches its titles only once it nears the viewport, and removes itself if there is nothing to show. */
export function LazyShelf({ id, title, load, deps = [], seeAll }) {
  const [ref, seen] = useInView();
  return (
    <div ref={ref} className="lazy-shelf">
      {seen ? <ShelfLoader id={id} title={title} load={load} deps={deps} seeAll={seeAll} /> : <Shelf id={id} title={title}><RowSkeleton /></Shelf>}
    </div>
  );
}

function ShelfLoader({ id, title, load, deps, seeAll }) {
  const { status, data, error, reload } = useAsync(load, deps);
  if (status === "loading") return <Shelf id={id} title={title}><RowSkeleton /></Shelf>;
  if (status === "error") return <Shelf id={id} title={title}><ErrorState error={error} onRetry={reload} /></Shelf>;
  if (!data?.length) return null;
  return <Shelf id={id} title={title} movies={data} seeAll={seeAll} />;
}
