import React from "react";
import { Link, useParams } from "react-router-dom";
import PagedGrid from "../components/PagedGrid";
import NotFound from "./NotFound";
import { LIST_CATEGORIES, getList } from "../api/tmdb";
import { useDocumentMeta } from "../hooks/useDocumentMeta";

/** "See all" target for the home-page shelves: /browse/popular, /browse/top-rated, … */
export default function Browse() {
  const { category } = useParams();
  const def = Object.prototype.hasOwnProperty.call(LIST_CATEGORIES, category) ? LIST_CATEGORIES[category] : null;
  useDocumentMeta({ title: def?.title, description: def ? `${def.title} films.` : undefined, path: `/browse/${category}`, noindex: !def });
  if (!def) return <NotFound />;
  return (
    <div className="container page-pad">
      <header className="page-head">
        <h1 className="page-title">{def.title}</h1>
        <p className="page-lede">
          Want to narrow this down? <Link className="text-link" to="/discover">Filter and sort in Discover</Link>.
        </p>
      </header>
      <PagedGrid resetKey={category} fetchPage={(page) => getList(category, page)} />
    </div>
  );
}
