import React, { Suspense, lazy } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import ErrorBoundary from "./components/ErrorBoundary";
import { ToastProvider } from "./context/Toasts";
import { CatalogProvider } from "./context/Catalog";
import { GenresProvider } from "./context/Genres";
import Home from "./pages/Home";

// The home page is part of the first load; everything else is split into its own chunk.
const Discover = lazy(() => import("./pages/Discover"));
const Browse = lazy(() => import("./pages/Browse"));
const Genres = lazy(() => import("./pages/Genres"));
const Library = lazy(() => import("./pages/Library"));
const Watchlist = lazy(() => import("./pages/Watchlist"));
const Search = lazy(() => import("./pages/Search"));
const MovieDetails = lazy(() => import("./pages/MovieDetails"));
const Watch = lazy(() => import("./pages/Watch"));
const NotFound = lazy(() => import("./pages/NotFound"));

const PageFallback = () => (
  <div className="page-loading" role="status">
    <div className="spinner" aria-hidden="true" />
    <span className="sr-only">Loading page</span>
  </div>
);

export default function App() {
  return (
    // PUBLIC_URL is "" in development and the homepage path (e.g. /movie-app) on GitHub Pages.
    <BrowserRouter basename={process.env.PUBLIC_URL || undefined} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ToastProvider>
        <CatalogProvider>
          <GenresProvider>
            <ErrorBoundary>
              <Suspense fallback={<PageFallback />}>
                <Routes>
                  <Route element={<Layout />}>
                    <Route index element={<Home />} />
                    <Route path="discover" element={<Discover />} />
                    <Route path="browse/:category" element={<Browse />} />
                    <Route path="genres" element={<Genres />} />
                    <Route path="library" element={<Library />} />
                    <Route path="watchlist" element={<Watchlist />} />
                    <Route path="search" element={<Search />} />
                    <Route path="movie/:param" element={<MovieDetails />} />
                    <Route path="watch/:param" element={<Watch />} />
                    <Route path="*" element={<NotFound />} />
                  </Route>
                </Routes>
              </Suspense>
            </ErrorBoundary>
          </GenresProvider>
        </CatalogProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
