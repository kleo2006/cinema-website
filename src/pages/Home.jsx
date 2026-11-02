import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import Hero from "../components/Hero";
import { LazyShelf, Shelf } from "../components/Row";
import ContinueCard from "../components/ContinueCard";
import { ErrorState } from "../components/States";
import { useAsync } from "../hooks/useAsync";
import { useCatalogMovies } from "../hooks/useCatalogMovies";
import { useDocumentMeta } from "../hooks/useDocumentMeta";
import { discoverMovies, getList } from "../api/tmdb";
import { ApiError, ErrorKind } from "../api/errors";
import { useCatalog } from "../context/Catalog";
import { useGenres } from "../context/Genres";
import { continueWatchingList, useProgress } from "../store/progress";
import { useWatchlist } from "../store/watchlist";

const COLLECTION_GENRES = ["Science Fiction", "Comedy", "Thriller"];

export default function Home() {
  useDocumentMeta({
    description: "Discover trending, popular and top-rated films, save a watchlist and watch the films available in full.",
    path: "/",
  });
  const trending = useAsync(() => getList("trending"), []);
  const catalog = useCatalog();
  const { list: genres } = useGenres();
  const progress = useProgress();
  const watchlist = useWatchlist();
  const fullFilms = useCatalogMovies(18);

  const results = trending.data?.results;
  const featured = useMemo(() => {
    if (!results) return null;
    const withArt = results.filter((m) => m.backdropPath && m.overview);
    return withArt.find((m) => catalog.has(m.id)) || withArt[0] || null;
  }, [results, catalog]);

  const resumable = continueWatchingList(progress).filter((e) => catalog.has(e.id));
  const collections = COLLECTION_GENRES.map((name) => genres.find((g) => g.name === name)).filter(Boolean);

  // Same configuration problem everywhere: show it once rather than on every shelf.
  const blocking = trending.error instanceof ApiError && [ErrorKind.CONFIG, ErrorKind.AUTH].includes(trending.error.kind);
  if (blocking) {
    return (
      <div className="container page-pad">
        <ErrorState error={trending.error} />
      </div>
    );
  }

  return (
    <>
      {/* One persistent hero: the background video must not restart when the skeleton gives way to the featured film. */}
      <Hero movie={featured} loading={trending.status === "loading"} />
      <div className="container shelves">
        {trending.status === "error" && <ErrorState error={trending.error} onRetry={trending.reload} />}

        {resumable.length > 0 && (
          <section className="section" aria-labelledby="continue-title">
            <div className="section-head">
              <h2 className="section-title" id="continue-title">Continue watching</h2>
              <p className="section-note">Saved on this device</p>
            </div>
            <ul className="row-track continue-track">
              {resumable.map((e) => (
                <li key={e.id} className="row-item continue-item">
                  <ContinueCard entry={e} />
                </li>
              ))}
            </ul>
          </section>
        )}

        {fullFilms.status === "success" && fullFilms.data.length > 0 && (
          <Shelf id="full" title="Watch in full" movies={fullFilms.data} seeAll="/library" />
        )}

        {results?.length > 0 && <Shelf id="trending" title="Trending this week" movies={results} seeAll="/browse/trending" />}

        {watchlist.length > 0 && <Shelf id="watchlist" title="From your watchlist" movies={watchlist.slice(0, 16)} seeAll="/watchlist" />}

        <LazyShelf id="popular" title="Popular" load={() => getList("popular").then((d) => d.results)} seeAll="/browse/popular" />
        <LazyShelf id="top-rated" title="Top rated" load={() => getList("top-rated").then((d) => d.results)} seeAll="/browse/top-rated" />
        <LazyShelf id="upcoming" title="Coming soon" load={() => getList("upcoming").then((d) => d.results)} seeAll="/browse/upcoming" />

        {collections.length > 0 && (
          <section className="section" aria-labelledby="genres-title">
            <div className="section-head">
              <h2 className="section-title" id="genres-title">Browse by genre</h2>
              <Link className="section-link" to="/genres">All genres</Link>
            </div>
            <ul className="chip-row">
              {genres.slice(0, 12).map((g) => (
                <li key={g.id}>
                  <Link className="chip" to={`/discover?genre=${g.id}`}>{g.name}</Link>
                </li>
              ))}
            </ul>
          </section>
        )}
        {collections.map((g) => (
          <LazyShelf key={g.id} id={`genre-${g.id}`} title={g.name} load={() => discoverMovies({ genre: g.id }).then((d) => d.results)} deps={[g.id]} seeAll={`/discover?genre=${g.id}`} />
        ))}
      </div>
    </>
  );
}
