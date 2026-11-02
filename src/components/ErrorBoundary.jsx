import React from "react";
import { ErrorState } from "./States";

/** Last line of defence: a rendering bug shows a recoverable message instead of a blank page. */
export default class ErrorBoundary extends React.Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="container page-pad">
        <ErrorState
          error={null}
          action={
            <a className="btn btn-primary" href={process.env.PUBLIC_URL || "/"}>
              Reload Cinema
            </a>
          }
        />
      </div>
    );
  }
}
