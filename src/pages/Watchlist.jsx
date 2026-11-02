import React from "react";
import { Link } from "react-router-dom";
import { Bookmark } from "lucide-react";
import MovieCard from "../components/MovieCard";
import { EmptyState } from "../components/States";
import { useDocumentMeta } from "../hooks/useDocumentMeta";
import { useWatchlist } from "../store/watchlist";

export default function Watchlist() {
  useDocumentMeta({ title: "Your watchlist", description: "Films you saved to watch later.", path: "/watchlist", noindex: true });
  const list = useWatchlist();
  return (
    <div className="container page-pad">
      <header className="page-head">
        <h1 className="page-title">Your watchlist</h1>
        <p className="page-lede">Saved on this device only. It isn’t linked to an account and won’t appear on your other devices.</p>
      </header>
      {list.length === 0 ? (
        <EmptyState icon={Bookmark} title="Nothing saved yet" action={<Link to="/discover" className="btn btn-primary">Find something to watch</Link>}>
          Use the bookmark on any film to save it here.
        </EmptyState>
      ) : (
        <>
          <p className="result-count" role="status">{list.length} saved</p>
          <ul className="poster-grid">
            {list.map((m) => <li key={m.id}><MovieCard movie={m} showWatch /></li>)}
          </ul>
        </>
      )}
    </div>
  );
}
