import React, { useRef, useState } from "react";
import { Link, useLocation, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, PlayCircle } from "lucide-react";
import Player from "../components/Player";
import TrailerDialog from "../components/TrailerDialog";
import { ErrorState } from "../components/States";
import MovieCard from "../components/MovieCard";
import NotFound from "./NotFound";
import { ApiError, ErrorKind } from "../api/errors";
import { getMovie } from "../api/tmdb";
import { Availability, describeAvailability } from "../playback/availability";
import { useCatalog } from "../context/Catalog";
import { useAsync } from "../hooks/useAsync";
import { useDocumentMeta } from "../hooks/useDocumentMeta";
import { usePlayback } from "../hooks/usePlayback";
import { formatRuntime, moviePath, parseMovieParam } from "../lib/format";
import { getProgress } from "../store/progress";

export default function Watch() {
  const { param } = useParams();
  const id = parseMovieParam(param);
  if (id === null) return <NotFound />;
  return <WatchPage id={id} key={id} />;
}

function WatchPage({ id }) {
  const location = useLocation();
  const [params] = useSearchParams();
  const catalog = useCatalog();
  const session = useRef({ position: null, retries: 0 });
  const [trailerOpen, setTrailerOpen] = useState(false);
  const meta = useAsync(() => getMovie(id), [id]);

  // Metadata trouble must not block a film that does have a source: fall back to what we stored locally.
  const metaFailed = meta.status === "error" && !(meta.error instanceof ApiError && meta.error.kind === ErrorKind.NOT_FOUND);
  const movie = meta.data || (metaFailed ? { id, title: getProgress(id)?.title || "this film", fallback: true, related: [], genres: [] } : null);
  const playback = usePlayback(movie);

  useDocumentMeta({ title: movie ? `Watch ${movie.title}` : "Watch", description: movie ? `Watch ${movie.title} in full.` : undefined, path: `/watch/${id}`, noindex: true });

  if (meta.status === "error" && !metaFailed) return <NotFound />;
  if (!movie || playback.status === "loading") {
    return (
      <div className="container watch">
        <div className="player player-placeholder" role="status">
          <div className="spinner" aria-hidden="true" />
          <span className="sr-only">Preparing playback</span>
        </div>
      </div>
    );
  }

  const back = moviePath(movie.fallback ? { id, title: "" } : movie);
  const result = playback.data;
  const availability = result?.availability;

  if (playback.status === "error" || availability !== Availability.FULL) {
    const info = describeAvailability(availability || Availability.UNAVAILABLE, result?.reason);
    // Retrying cannot fix a malformed setting or catalogue entry; everything else about UNAVAILABLE may be transient.
    const canRetry = availability === Availability.UNAVAILABLE && !["config", "invalid"].includes(result?.reason);
    return (
      <div className="container watch">
        <Link to={back} className="back-link"><ArrowLeft size={16} aria-hidden="true" />Back to details</Link>
        {playback.status === "error" ? (
          <ErrorState error={playback.error} onRetry={playback.reload} />
        ) : (
          <div className="state watch-blocked" role="status">
            <h1 className="state-title">{movie.title}</h1>
            <h2>{info.label}</h2>
            <p>{info.message}</p>
            <div className="state-actions">
              {canRetry && <button type="button" className="btn btn-primary" onClick={playback.reload}>Try again</button>}
              {movie.trailer && (
                <button type="button" className="btn btn-ghost" onClick={() => setTrailerOpen(true)}>
                  <PlayCircle size={16} aria-hidden="true" />
                  Watch trailer instead
                </button>
              )}
              <Link to={back} className="btn btn-ghost">View details</Link>
              <Link to="/library" className="btn btn-ghost">Films you can watch</Link>
            </div>
          </div>
        )}
        <TrailerDialog trailer={trailerOpen ? movie.trailer : null} title={movie.title} onClose={() => setTrailerOpen(false)} />
      </div>
    );
  }

  const intent = params.get("resume") === "1" ? "resume" : "prompt";
  const next = (movie.related || []).filter((m) => catalog.has(m.id) && m.id !== id).slice(0, 4);

  return (
    <div className="container watch">
      <Link to={back} className="back-link"><ArrowLeft size={16} aria-hidden="true" />Back to details</Link>
      <Player
        movie={movie}
        playback={result}
        intent={intent}
        autoplay={Boolean(location.state?.autoplay)}
        session={session}
        onRetry={playback.reload}
        endSlot={
          next.length > 0 ? (
            <ul className="end-list">
              {next.map((m) => <li key={m.id}><MovieCard movie={m} showWatch /></li>)}
            </ul>
          ) : null
        }
      />
      <header className="watch-info">
        <h1 className="watch-title">{movie.title}</h1>
        <p className="facts">
          {movie.year && <span>{movie.year}</span>}
          {formatRuntime(movie.runtime) && <span>{formatRuntime(movie.runtime)}</span>}
          {movie.genres.length > 0 && <span>{movie.genres.map((g) => g.name).join(" · ")}</span>}
        </p>
        {movie.overview && <p className="watch-overview">{movie.overview}</p>}
        {result.license && (
          <p className="license">
            Licence: {result.license.name}
            {result.license.holder ? ` · ${result.license.holder}` : ""}
            {result.license.url && (
              <> · <a className="text-link" href={result.license.url} target="_blank" rel="noopener noreferrer">Terms</a></>
            )}
          </p>
        )}
        <p className="hint">Shortcuts (video focused): Space or K play/pause · J / L skip 10s · M mute · F fullscreen</p>
      </header>
    </div>
  );
}
