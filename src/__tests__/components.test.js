import React from "react";
import { MemoryRouter } from "react-router-dom";
import { act, fireEvent, render, screen } from "@testing-library/react";
import MovieCard from "../components/MovieCard";
import WatchlistButton from "../components/WatchlistButton";
import { ToastProvider } from "../context/Toasts";
import { CatalogProvider } from "../context/Catalog";
import { watchlistStore } from "../store/watchlist";
import { resetCatalogCache } from "../playback/catalog";

const movie = { id: 42, title: "Answer Film", year: "1999", voteAverage: 8.123, posterPath: null, genreIds: [] };

beforeEach(() => {
  resetCatalogCache();
  localStorage.clear();
  watchlistStore.reset();
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ titles: { 42: { status: "available", sources: [{ src: "https://x.test/a.mp4", type: "mp4" }] } } }) });
});

/** Lets the mocked catalogue request resolve and its state update flush. */
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

const renderCard = (props) =>
  render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ToastProvider>
        <CatalogProvider>
          <MovieCard movie={movie} {...props} />
        </CatalogProvider>
      </ToastProvider>
    </MemoryRouter>,
  );

test("card links to a stable details URL and shows year and rating; missing poster falls back", async () => {
  renderCard();
  expect(screen.getByRole("link", { name: /Answer Film/ })).toHaveAttribute("href", "/movie/42-answer-film");
  expect(screen.getByText("1999")).toBeInTheDocument();
  expect(screen.getByText(/8\.1/)).toBeInTheDocument();
  expect(screen.getByRole("img", { name: /No poster available/ })).toBeInTheDocument();
  await settle();
});

test("badge and Watch action appear only once the catalogue says the film is playable", async () => {
  renderCard({ showWatch: true });
  expect(screen.queryByText("Full film")).not.toBeInTheDocument();
  expect(await screen.findByText("Full film")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /Watch movie/ })).toHaveAttribute("href", "/watch/42");
});

test("film absent from the catalogue never shows Watch", async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ titles: {} }) });
  resetCatalogCache();
  renderCard({ showWatch: true });
  await settle();
  expect(screen.queryByRole("link", { name: /Watch movie/ })).not.toBeInTheDocument();
});

test("watchlist button toggles, announces and stays in sync across instances", async () => {
  render(
    <ToastProvider>
      <WatchlistButton movie={movie} />
      <WatchlistButton movie={movie} variant="button" />
    </ToastProvider>,
  );
  const [icon, labelled] = screen.getAllByRole("button").filter((b) => b.hasAttribute("aria-pressed"));
  expect(icon).toHaveAttribute("aria-pressed", "false");
  fireEvent.click(icon);
  expect(icon).toHaveAttribute("aria-pressed", "true");
  expect(labelled).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("status")).toHaveTextContent("Added");
  fireEvent.click(labelled);
  expect(icon).toHaveAttribute("aria-pressed", "false");
});
