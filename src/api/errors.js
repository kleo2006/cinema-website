/** Error kinds the UI knows how to explain. */
export const ErrorKind = Object.freeze({
  CONFIG: "config",
  AUTH: "auth",
  NOT_FOUND: "not-found",
  RATE_LIMIT: "rate-limit",
  SERVER: "server",
  NETWORK: "network",
  UNKNOWN: "unknown",
});

export class ApiError extends Error {
  constructor(kind, message, { status, retryAfter } = {}) {
    super(message);
    this.name = "ApiError";
    this.kind = kind;
    this.status = status;
    this.retryAfter = retryAfter;
  }

  /** Retrying can reasonably help for these kinds. */
  get retryable() {
    return [ErrorKind.NETWORK, ErrorKind.RATE_LIMIT, ErrorKind.SERVER, ErrorKind.UNKNOWN].includes(this.kind);
  }
}

/** User-facing copy. Never includes URLs, keys or stack traces. */
export function describeError(error) {
  const kind = error instanceof ApiError ? error.kind : ErrorKind.UNKNOWN;
  switch (kind) {
    case ErrorKind.CONFIG:
      return {
        title: "Movie data isn’t configured",
        message: "Set REACT_APP_API_KEY (a TMDB API key) or a valid REACT_APP_TMDB_BASE_URL and rebuild the app. The README explains how.",
      };
    case ErrorKind.AUTH:
      return { title: "The movie data key was rejected", message: "Check that REACT_APP_API_KEY holds a valid TMDB v3 API key." };
    case ErrorKind.NOT_FOUND:
      return { title: "We couldn’t find that", message: "It may have been removed or the link may be wrong." };
    case ErrorKind.RATE_LIMIT:
      return { title: "Too many requests", message: "The movie data service asked us to slow down. Try again in a few seconds." };
    case ErrorKind.SERVER:
      return { title: "The movie service is having trouble", message: "It’s a problem on their side. Try again in a moment." };
    case ErrorKind.NETWORK:
      return { title: "You appear to be offline", message: "Check your connection and try again." };
    default:
      return { title: "Something went wrong", message: "An unexpected error occurred. Try again." };
  }
}
