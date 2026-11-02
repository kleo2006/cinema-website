import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Info, Play, PlayCircle, Star } from "lucide-react";
import { Backdrop } from "./Images";
import HeroVideo from "./HeroVideo";
import WatchlistButton from "./WatchlistButton";
import TrailerDialog from "./TrailerDialog";
import { useCatalog } from "../context/Catalog";
import { useGenres } from "../context/Genres";
import { useAsync } from "../hooks/useAsync";
import { getMovie } from "../api/tmdb";
import { formatRating, formatRuntime, moviePath, watchPath } from "../lib/format";

/**
 * Full-screen opening. One section owns the layers for the whole life of the page, so the background video keeps playing
 * through the loading state and when the featured film changes:
 *   movie backdrop (fallback) → looping video → gradients (.hero-media::after) → copy.
 * Without a `movie` it shows a skeleton while `loading`, and renders nothing once loading has finished empty-handed.
 */
export default function Hero({ movie = null, loading = false }) {
  if (!movie && !loading) return null;
  return (
    <section className="hero" data-hero aria-labelledby={movie ? "hero-title" : undefined} aria-hidden={movie ? undefined : "true"}>
      <div className="hero-media" aria-hidden="true">
        {movie && <Backdrop key={movie.id} path={movie.backdropPath} hero />}
        <HeroVideo />
      </div>
      {movie ? <HeroCopy key={movie.id} movie={movie} /> : <HeroSkeletonCopy />}
    </section>
  );
}

/**
 * Featured title. The primary action depends on what is actually available:
 * "Watch movie" only when a full-length source is configured, otherwise the trailer or details.
 */
function HeroCopy({ movie }) {
  const catalog = useCatalog();
  const { byId } = useGenres();
  const [trailerOpen, setTrailerOpen] = useState(false);
  // Details add the trailer, runtime and genre names; the hero is already usable without them.
  const { data: details } = useAsync(() => getMovie(movie.id).catch(() => null), [movie.id]);
  const full = details || movie;
  const detailGenres = (details?.genres || []).map((g) => g.name);
  const genres = (detailGenres.length ? detailGenres : (movie.genreIds || []).map((id) => byId.get(id)).filter(Boolean)).slice(0, 3);
  const rating = formatRating(full.voteAverage);
  const runtime = formatRuntime(details?.runtime);
  const playable = catalog.has(movie.id);
  const trailer = details?.trailer || null;

  return (
    <>
      <div className="container hero-inner">
        <div className="hero-copy">
          <p className="eyebrow">{playable ? "Featured · Watch in full" : "Featured this week"}</p>
          <h1 id="hero-title" className="hero-title">{movie.title}</h1>
          <p className="facts">
            {movie.year && <span>{movie.year}</span>}
            {rating && (
              <span className="rating">
                <Star size={14} aria-hidden="true" />
                {rating}
              </span>
            )}
            {runtime && <span>{runtime}</span>}
            {genres.length > 0 && <span>{genres.join(" · ")}</span>}
          </p>
          {movie.overview && <p className="hero-overview">{movie.overview}</p>}
          <div className="hero-actions">
            {playable && (
              <Link to={watchPath(movie.id)} state={{ autoplay: true }} className="btn btn-primary btn-lg">
                <Play size={18} aria-hidden="true" />
                Watch movie
              </Link>
            )}
            {!playable && trailer && (
              <button type="button" className="btn btn-primary btn-lg" onClick={() => setTrailerOpen(true)}>
                <PlayCircle size={18} aria-hidden="true" />
                Watch trailer
              </button>
            )}
            <Link to={moviePath(movie)} className={`btn btn-lg ${playable || trailer ? "btn-ghost" : "btn-primary"}`}>
              <Info size={18} aria-hidden="true" />
              More details
            </Link>
            {playable && trailer && (
              <button type="button" className="btn btn-ghost btn-lg" onClick={() => setTrailerOpen(true)}>
                <PlayCircle size={18} aria-hidden="true" />
                Watch trailer
              </button>
            )}
            <WatchlistButton movie={movie} variant="button" className="btn-lg" />
          </div>
          {!playable && <p className="hero-note">The full film isn’t available to stream on Cinema.</p>}
        </div>
      </div>
      <TrailerDialog trailer={trailerOpen ? trailer : null} title={movie.title} onClose={() => setTrailerOpen(false)} />
    </>
  );
}

function HeroSkeletonCopy() {
  return (
    <div className="container hero-inner">
      <div className="hero-copy">
        <div className="skeleton sk-line sk-sm" />
        <div className="skeleton sk-title" />
        <div className="skeleton sk-line" />
        <div className="skeleton sk-line sk-md" />
      </div>
    </div>
  );
}
