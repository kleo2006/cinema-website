import React from "react";
import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="container footer-row">
        <p>
          <strong>Cinema</strong> · Film data and images from{" "}
          <a href="https://www.themoviedb.org/" target="_blank" rel="noopener noreferrer">TMDB</a>. This product uses the TMDB API but is not endorsed or certified by TMDB.
        </p>
        <nav aria-label="Footer">
          <Link to="/discover">Discover</Link>
          <Link to="/library">Full films</Link>
          <Link to="/watchlist">Watchlist</Link>
        </nav>
      </div>
    </footer>
  );
}
