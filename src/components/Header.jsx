import React, { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { Clapperboard, Menu, Search, X } from "lucide-react";
import SearchBox from "./SearchBox";
import { useWatchlist } from "../store/watchlist";

const LINKS = [
  { to: "/", label: "Home", end: true },
  { to: "/discover", label: "Discover" },
  { to: "/genres", label: "Genres" },
  { to: "/library", label: "Full films" },
  { to: "/watchlist", label: "Watchlist", count: true },
];

export default function Header() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const toggle = useRef(null);
  const panel = useRef(null);
  const header = useRef(null);
  const watchlist = useWatchlist();
  const isHome = pathname === "/";
  const [pastHero, setPastHero] = useState(false);

  useEffect(() => setOpen(false), [pathname]);

  // Home only: the header floats transparently over the full-screen hero and turns solid once the hero has scrolled
  // underneath it. State changes only when that boundary is crossed, not on every scroll event.
  useEffect(() => {
    if (!isHome) {
      setPastHero(false);
      return undefined;
    }
    let frame = 0;
    const measure = () => {
      frame = 0;
      const hero = document.querySelector("[data-hero]");
      const barHeight = header.current?.offsetHeight || 0;
      // Without a hero (e.g. the catalogue could not load) there is nothing to float over, so go solid on first scroll.
      setPastHero(hero ? hero.getBoundingClientRect().bottom <= barHeight : window.scrollY > 8);
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [isHome]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") {
        setOpen(false);
        toggle.current?.focus();
      }
    };
    const onDown = (e) => {
      if (!panel.current?.contains(e.target) && !toggle.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  return (
    <header ref={header} className={`site-header${isHome ? " is-home" : ""}${isHome && !pastHero && !open ? " is-overlay" : ""}`}>
      <div className="container header-row">
        <Link to="/" className="brand" aria-label="Cinema home">
          <Clapperboard size={22} aria-hidden="true" />
          <span>Cinema</span>
        </Link>

        <nav className="nav-desktop" aria-label="Primary">
          <ul>
            {LINKS.map((l) => (
              <li key={l.to}>
                <NavLink to={l.to} end={l.end} className="nav-link">
                  {l.label}
                  {l.count && watchlist.length > 0 && <span className="nav-count" aria-label={`${watchlist.length} saved`}>{watchlist.length}</span>}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <SearchBox className="header-search" />

        <Link to="/search" className="btn btn-icon btn-ghost header-search-link" aria-label="Search films">
          <Search size={20} aria-hidden="true" />
        </Link>
        <button
          type="button"
          ref={toggle}
          className="btn btn-icon btn-ghost menu-toggle"
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
        </button>
      </div>

      <nav id="mobile-menu" ref={panel} className="nav-mobile" aria-label="Primary mobile" hidden={!open}>
        <ul className="container">
          {LINKS.map((l) => (
            <li key={l.to}>
              <NavLink to={l.to} end={l.end} className="nav-link">
                {l.label}
                {l.count && watchlist.length > 0 && <span className="nav-count">{watchlist.length}</span>}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
