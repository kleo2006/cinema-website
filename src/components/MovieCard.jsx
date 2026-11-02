import React, { memo } from "react";
import { Link } from "react-router-dom";
import { Play, Star } from "lucide-react";
import { Poster } from "./Images";
import WatchlistButton from "./WatchlistButton";
import AvailabilityBadge from "./AvailabilityBadge";
import { useCatalog } from "../context/Catalog";
import { useGenres } from "../context/Genres";
import { formatRating, moviePath, watchPath } from "../lib/format";

/**
 * Poster card. Accepts a normalized movie or a watchlist entry (which has no genres or overview).
 * Everything essential — opening details, saving, watching — is a real link or button, so nothing depends on hover.
 * The "Full film" badge and the Watch action appear only when a full-length source is configured for this title.
 */
function MovieCard({ movie, priority = false, showWatch = false }) {
  const catalog = useCatalog();
  const { byId } = useGenres();
  const year = movie.year || (movie.releaseDate ? movie.releaseDate.slice(0, 4) : null);
  const rating = formatRating(movie.voteAverage);
  const genre = movie.genreIds?.length ? byId.get(movie.genreIds[0]) : movie.genres?.[0]?.name;
  const playable = catalog.has(movie.id);

  return (
    <article className="card">
      <Link to={moviePath(movie)} className="card-link">
        <div className="card-media">
          <Poster path={movie.posterPath} title={movie.title} priority={priority} />
          {playable && <AvailabilityBadge className="card-badge" />}
        </div>
        <h3 className="card-title">{movie.title}</h3>
        <p className="card-meta">
          {year && <span>{year}</span>}
          {rating && (
            <span className="rating">
              <Star size={11} aria-hidden="true" /> {rating}
              <span className="sr-only"> out of 10</span>
            </span>
          )}
          {genre && <span>{genre}</span>}
        </p>
      </Link>
      <WatchlistButton movie={movie} className="card-save" />
      {showWatch && playable && (
        <Link to={watchPath(movie.id)} state={{ autoplay: true }} className="btn btn-primary card-watch">
          <Play size={16} aria-hidden="true" />
          Watch movie
        </Link>
      )}
    </article>
  );
}

export default memo(MovieCard);
