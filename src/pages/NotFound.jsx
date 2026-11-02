import React from "react";
import { Link } from "react-router-dom";
import { Clapperboard } from "lucide-react";
import { EmptyState } from "../components/States";
import { useDocumentMeta } from "../hooks/useDocumentMeta";

export default function NotFound() {
  useDocumentMeta({ title: "Page not found", description: "This page doesn’t exist.", noindex: true });
  return (
    <div className="container page-pad">
      <EmptyState
        icon={Clapperboard}
        title="This page isn’t showing"
        action={
          <>
            <Link to="/" className="btn btn-primary">Back to home</Link>
            <Link to="/discover" className="btn btn-ghost">Discover films</Link>
          </>
        }
      >
        The link may be wrong or the film may have been removed.
      </EmptyState>
    </div>
  );
}
