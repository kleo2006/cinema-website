import React from "react";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { isInWatchlist, toggleWatchlist, useWatchlist } from "../store/watchlist";
import { useToast } from "../context/Toasts";

/** One control, used on cards, the hero and detail pages. All instances share the same store, so they stay in sync. */
export default function WatchlistButton({ movie, variant = "icon", className = "" }) {
  const list = useWatchlist();
  const { notify } = useToast();
  const saved = isInWatchlist(list, movie.id);

  const onClick = () => {
    const nowSaved = toggleWatchlist(movie);
    notify(nowSaved ? `Added “${movie.title}” to your watchlist` : `Removed “${movie.title}” from your watchlist`, { tone: nowSaved ? "success" : "info" });
  };
  const Icon = saved ? BookmarkCheck : Bookmark;
  const label = saved ? "In watchlist" : "Add to watchlist";

  if (variant === "icon") {
    return (
      <button type="button" className={`save-btn ${className}`} aria-pressed={saved} aria-label={`${saved ? "Remove from" : "Add to"} watchlist: ${movie.title}`} onClick={onClick}>
        <Icon size={18} aria-hidden="true" />
      </button>
    );
  }
  return (
    <button type="button" className={`btn btn-ghost ${className}`} aria-pressed={saved} onClick={onClick}>
      <Icon size={18} aria-hidden="true" />
      {label}
    </button>
  );
}
