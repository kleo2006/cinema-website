import React from "react";
import { AlertTriangle, Clapperboard, SearchX } from "lucide-react";
import { ApiError, describeError } from "../api/errors";

/** `title` / `message` replace the generic copy when the caller knows better (e.g. the film list failed to load). */
export function ErrorState({ error, onRetry, action, title: customTitle, message: customMessage }) {
  const described = describeError(error);
  const title = customTitle || described.title;
  const message = customMessage || described.message;
  const canRetry = onRetry && (!(error instanceof ApiError) || error.retryable);
  return (
    <div className="state state-error" role="alert">
      <AlertTriangle className="state-icon" size={40} aria-hidden="true" />
      <h2>{title}</h2>
      <p>{message}</p>
      <div className="state-actions">
        {canRetry && (
          <button type="button" className="btn btn-primary" onClick={onRetry}>
            Try again
          </button>
        )}
        {action}
      </div>
    </div>
  );
}

export function EmptyState({ title, children, icon: Icon = SearchX, action }) {
  return (
    <div className="state">
      <Icon className="state-icon" size={40} aria-hidden="true" />
      <h2>{title}</h2>
      {children && <p>{children}</p>}
      {action && <div className="state-actions">{action}</div>}
    </div>
  );
}

export const NoFilmsIcon = Clapperboard;

export function GridSkeleton({ count = 12 }) {
  return (
    <div className="poster-grid" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="card-skeleton">
          <div className="skeleton skeleton-poster" />
          <div className="skeleton skeleton-line" />
        </div>
      ))}
    </div>
  );
}

export function RowSkeleton({ count = 8 }) {
  return (
    <div className="row-track" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="row-item card-skeleton">
          <div className="skeleton skeleton-poster" />
          <div className="skeleton skeleton-line" />
        </div>
      ))}
    </div>
  );
}
