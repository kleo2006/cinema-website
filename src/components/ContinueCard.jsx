import React from "react";
import { Link } from "react-router-dom";
import { Play, X } from "lucide-react";
import { Backdrop } from "./Images";
import { clearProgress } from "../store/progress";
import { formatClock } from "../lib/format";

/** A resumable film with a progress bar. Links straight to the player at the saved position. */
export default function ContinueCard({ entry }) {
  const ratio = entry.duration ? Math.min(entry.position / entry.duration, 1) : 0;
  const left = entry.duration ? formatClock(entry.duration - entry.position) : null;
  return (
    <article className="continue-card">
      <Link to={`/watch/${entry.id}?resume=1`} state={{ autoplay: true }} className="continue-link" aria-label={`Resume ${entry.title} from ${formatClock(entry.position)}`}>
        <div className="continue-media">
          <Backdrop path={entry.backdropPath || entry.posterPath} />
          <span className="continue-play" aria-hidden="true">
            <Play size={20} />
          </span>
          {entry.duration && (
            <div className="progress" role="img" aria-label={`${Math.round(ratio * 100)} percent watched`}>
              <span style={{ width: `${ratio * 100}%` }} />
            </div>
          )}
        </div>
        <h3 className="card-title">{entry.title || "Untitled film"}</h3>
        <p className="card-meta">
          <span>Resume at {formatClock(entry.position)}</span>
          {left && <span>{left} left</span>}
        </p>
      </Link>
      <button type="button" className="save-btn card-save" aria-label={`Remove ${entry.title} from Continue watching`} onClick={() => clearProgress(entry.id)}>
        <X size={18} aria-hidden="true" />
      </button>
    </article>
  );
}
