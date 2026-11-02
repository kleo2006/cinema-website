import React, { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Check, Film, Play, PlayCircle, Share2, Star, TriangleAlert } from "lucide-react";
import { Avatar, Backdrop, Poster } from "../components/Images";
import WatchlistButton from "../components/WatchlistButton";
import TrailerDialog from "../components/TrailerDialog";
import { Shelf } from "../components/Row";
import { EmptyState, ErrorState } from "../components/States";
import NotFound from "./NotFound";
import { ApiError, ErrorKind } from "../api/errors";
import { getMovie } from "../api/tmdb";
import { imageUrl } from "../api/images";
import { describeAvailability, Availability } from "../playback/availability";
import { absoluteUrl } from "../config";
import { useToast } from "../context/Toasts";
import { useAsync } from "../hooks/useAsync";
import { useDocumentMeta } from "../hooks/useDocumentMeta";
import { usePlayback } from "../hooks/usePlayback";
import { formatClock, formatCount, formatDate, formatRating, formatRuntime, moviePath, parseMovieParam, watchPath } from "../lib/format";
import { getProgress, isResumable, useProgress } from "../store/progress";

export default function MovieDetails() {
  const { param } = useParams();
  const id = parseMovieParam(param);
  if (id === null) return <NotFound />;
  return <Details id={id} key={id} />;
}

function Details({ id }) {
  const { status, data: movie, error, reload } = useAsync(() => getMovie(id), [id]);
  const [trailerOpen, setTrailerOpen] = useState(false);
  const playback = usePlayback(movie);
  const { notify } = useToast();
  useProgress(); // re-render when saved progress changes
  const saved = getProgress(id);

  useDocumentMeta({
    title: movie ? `${movie.title}${movie.year ? ` (${movie.year})` : ""}` : "Film",
    description: movie?.overview ? movie.overview.slice(0, 200) : movie ? `Details for ${movie.title}.` : undefined,
    image: movie?.posterPath ? imageUrl(movie.posterPath, "w780") : undefined,
    path: movie ? moviePath(movie) : undefined,
    type: "video.movie",
    noindex: status !== "success",
  });

  if (status === "loading") return <DetailsSkeleton />;
  if (status === "error") {
    if (error instanceof ApiError && error.kind === ErrorKind.NOT_FOUND) return <NotFound />;
    return (
      <div className="container page-pad">
        <ErrorState error={error} onRetry={reload} action={<Link to="/" className="btn btn-ghost">Back to home</Link>} />
      </div>
    );
  }

  const rating = formatRating(movie.voteAverage);
  const availability = playback.data?.availability;
  const info = availability ? describeAvailability(availability, playback.data?.reason) : null;
  const resume = saved && isResumable(saved.position, saved.duration) && availability === Availability.FULL;
  const directors = movie.director.join(", ");

  const share = async () => {
    const url = absoluteUrl(moviePath(movie));
    try {
      if (navigator.share) {
        await navigator.share({ title: movie.title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      notify("Link copied to clipboard");
    } catch (e) {
      if (e?.name !== "AbortError") notify("Couldn’t share this link", { tone: "info" });
    }
  };

  return (
    <article className="details">
      <div className="details-hero">
        <Backdrop path={movie.backdropPath} hero className="details-backdrop" />
        <div className="container details-top">
          <div className="details-poster">
            <Poster path={movie.posterPath} title={movie.title} priority />
          </div>
          <div className="details-main">
            <h1 className="details-title">{movie.title}</h1>
            {movie.tagline && <p className="details-tagline">{movie.tagline}</p>}
            <p className="facts">
              {movie.year && <span>{movie.year}</span>}
              {rating && (
                <span className="rating" title={`${formatCount(movie.voteCount)} votes`}>
                  <Star size={14} aria-hidden="true" />
                  {rating}
                  <span className="muted"> ({formatCount(movie.voteCount)} votes)</span>
                </span>
              )}
              {formatRuntime(movie.runtime) && <span>{formatRuntime(movie.runtime)}</span>}
              {movie.status && movie.status !== "Released" && <span>{movie.status}</span>}
            </p>
            {movie.genres.length > 0 && (
              <ul className="chip-row">
                {movie.genres.map((g) => (
                  <li key={g.id}><Link className="chip" to={`/discover?genre=${g.id}`}>{g.name}</Link></li>
                ))}
              </ul>
            )}

            <div className="details-actions">
              {playback.status === "loading" && <span className="btn btn-primary" aria-disabled="true"><span className="spinner spinner-sm" aria-hidden="true" />Checking availability</span>}
              {availability === Availability.FULL && (
                <Link to={watchPath(id)} state={{ autoplay: true }} className="btn btn-primary btn-lg">
                  <Play size={18} aria-hidden="true" />
                  {resume ? `Resume from ${formatClock(saved.position)}` : "Watch movie"}
                </Link>
              )}
              {movie.trailer && (
                <button type="button" className={`btn btn-lg ${availability === Availability.FULL ? "btn-ghost" : "btn-primary"}`} onClick={() => setTrailerOpen(true)}>
                  <PlayCircle size={18} aria-hidden="true" />
                  Watch trailer
                </button>
              )}
              <WatchlistButton movie={movie} variant="button" className="btn-lg" />
              <button type="button" className="btn btn-ghost btn-lg" onClick={share}>
                <Share2 size={18} aria-hidden="true" />
                Share
              </button>
            </div>

            {info && (
              <p className={`availability availability-${availability}`} role="status">
                {availability === Availability.FULL ? <Check size={16} aria-hidden="true" /> : <TriangleAlert size={16} aria-hidden="true" />}
                <span><strong>{info.label}.</strong> {info.message}</span>
              </p>
            )}
            {playback.data?.license && availability === Availability.FULL && (
              <p className="license">
                Licence: {playback.data.license.name}
                {playback.data.license.holder ? ` · ${playback.data.license.holder}` : ""}
                {playback.data.license.url && (
                  <> · <a className="text-link" href={playback.data.license.url} target="_blank" rel="noopener noreferrer">Terms</a></>
                )}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="container details-body">
        <div className="details-columns">
          <section aria-labelledby="overview-title">
            <h2 className="section-title" id="overview-title">Overview</h2>
            <p className="overview">{movie.overview || "No synopsis is available for this film yet."}</p>
          </section>
          <dl className="facts-list">
            {formatDate(movie.releaseDate) && (<><dt>Release date</dt><dd>{formatDate(movie.releaseDate)}</dd></>)}
            {directors && (<><dt>{movie.director.length > 1 ? "Directors" : "Director"}</dt><dd>{directors}</dd></>)}
            {movie.productionCompanies.length > 0 && (<><dt>Production</dt><dd>{movie.productionCompanies.slice(0, 4).join(", ")}</dd></>)}
          </dl>
        </div>

        {movie.cast.length > 0 && (
          <section className="section" aria-labelledby="cast-title">
            <h2 className="section-title" id="cast-title">Cast</h2>
            <ul className="cast-grid">
              {movie.cast.map((c) => (
                <li key={`${c.id}-${c.character}`} className="cast-item">
                  <Avatar path={c.profilePath} name={c.name} />
                  <div>
                    <p className="cast-name">{c.name}</p>
                    {c.character && <p className="cast-role">{c.character}</p>}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {movie.related.length > 0 ? (
          <Shelf id="related" title="More like this" movies={movie.related} />
        ) : (
          <EmptyState icon={Film} title="No related films" />
        )}
      </div>

      <TrailerDialog trailer={trailerOpen ? movie.trailer : null} title={movie.title} onClose={() => setTrailerOpen(false)} />
    </article>
  );
}

function DetailsSkeleton() {
  return (
    <div className="container details-top details-skeleton" aria-hidden="true">
      <div className="skeleton sk-poster" />
      <div className="details-main">
        <div className="skeleton sk-title" />
        <div className="skeleton sk-line sk-md" />
        <div className="skeleton sk-line" />
        <div className="skeleton sk-line" />
      </div>
    </div>
  );
}
