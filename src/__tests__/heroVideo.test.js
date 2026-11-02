import React from "react";
import { MemoryRouter } from "react-router-dom";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import HeroVideo, { HERO_VIDEO_SRC } from "../components/HeroVideo";
import Hero from "../components/Hero";
import Header from "../components/Header";

const router = (ui, path = "/") => (
  <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    {ui}
  </MemoryRouter>
);
const queryVideo = () => screen.queryByTestId("hero-video");
/** Lets the header search box finish its (empty) lookup so no state update lands outside act(). */
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

function mockMatchMedia(reduced) {
  window.matchMedia = jest.fn().mockImplementation((query) => ({
    matches: reduced && query.includes("prefers-reduced-motion"),
    media: query,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  }));
}

beforeEach(() => {
  delete window.matchMedia;
  Object.defineProperty(navigator, "connection", { value: undefined, configurable: true });
  // jsdom does not implement media playback.
  window.HTMLMediaElement.prototype.play = jest.fn().mockResolvedValue(undefined);
  window.HTMLMediaElement.prototype.pause = jest.fn();
});

describe("HeroVideo", () => {
  test("is a muted, looping, inline, decorative background with no controls", () => {
    render(<HeroVideo />);
    const video = screen.getByTestId("hero-video");
    expect(video).toBeInTheDocument();
    expect(video.muted).toBe(true);
    expect(video).toHaveAttribute("loop");
    expect(video).toHaveAttribute("autoplay");
    expect(video).toHaveAttribute("playsinline");
    expect(video).not.toHaveAttribute("controls");
    expect(video).toHaveAttribute("aria-hidden", "true");
    expect(video).toHaveAttribute("tabindex", "-1");
    expect(video).toHaveAttribute("src", HERO_VIDEO_SRC);
  });

  test("stays invisible until frames are playing, then fades in", () => {
    render(<HeroVideo />);
    const video = screen.getByTestId("hero-video");
    expect(video).not.toHaveClass("is-playing");
    fireEvent.playing(video);
    expect(video).toHaveClass("is-playing");
  });

  test("a load error removes the video so the movie backdrop is what remains", () => {
    render(<HeroVideo />);
    fireEvent.error(screen.getByTestId("hero-video"));
    expect(queryVideo()).toBeNull();
  });

  test("a rejected autoplay promise is swallowed and the video never becomes visible", async () => {
    window.HTMLMediaElement.prototype.play = jest.fn().mockRejectedValue(new DOMException("blocked", "NotAllowedError"));
    render(<HeroVideo />);
    await waitFor(() => expect(window.HTMLMediaElement.prototype.play).toHaveBeenCalled());
    expect(screen.getByTestId("hero-video")).not.toHaveClass("is-playing");
  });

  test("renders nothing (and so downloads nothing) when reduced motion is preferred", () => {
    mockMatchMedia(true);
    render(<HeroVideo />);
    expect(queryVideo()).toBeNull();
  });

  test("renders nothing when the browser reports Data Saver", () => {
    Object.defineProperty(navigator, "connection", { value: { saveData: true }, configurable: true });
    render(<HeroVideo />);
    expect(queryVideo()).toBeNull();
  });

  test("the URL is built from PUBLIC_URL so it works under /movie-app on GitHub Pages", () => {
    const previous = process.env.PUBLIC_URL;
    process.env.PUBLIC_URL = "/movie-app";
    let src;
    jest.isolateModules(() => {
      src = require("../components/HeroVideo").HERO_VIDEO_SRC;
    });
    process.env.PUBLIC_URL = previous;
    expect(src).toBe("/movie-app/videos/cinema-background.mp4");
  });
});

describe("Hero stage", () => {
  test("shows the video behind a skeleton while loading, so there is no gap before the featured film arrives", () => {
    render(router(<Hero movie={null} loading />));
    expect(screen.getByTestId("hero-video")).toBeInTheDocument();
    // The skeleton is decorative, so nothing about it is announced to assistive technology.
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });

  test("renders nothing when loading has finished without a featured film", () => {
    render(router(<Hero movie={null} loading={false} />));
    expect(queryVideo()).toBeNull();
  });
});

describe("Header on the home page", () => {
  const renderHeader = (path) => render(router(<Header />, path));

  test("floats transparently over the hero at the top of the home page", async () => {
    renderHeader("/");
    await settle();
    const header = screen.getByRole("banner");
    expect(header).toHaveClass("is-home");
    expect(header).toHaveClass("is-overlay");
  });

  test("goes solid once the hero has scrolled under it", async () => {
    const hero = document.createElement("section");
    hero.setAttribute("data-hero", "");
    document.body.appendChild(hero);
    hero.getBoundingClientRect = () => ({ bottom: -10 });
    renderHeader("/");
    await settle();
    expect(screen.getByRole("banner")).not.toHaveClass("is-overlay");
    hero.remove();
  });

  test("other routes keep the existing header untouched", async () => {
    renderHeader("/discover");
    await settle();
    const header = screen.getByRole("banner");
    expect(header).not.toHaveClass("is-home");
    expect(header).not.toHaveClass("is-overlay");
  });

  test("opening the mobile menu makes the bar solid", async () => {
    renderHeader("/");
    await settle();
    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    expect(screen.getByRole("banner")).not.toHaveClass("is-overlay");
  });
});
