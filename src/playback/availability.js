/**
 * Playback availability is modelled explicitly and is never inferred from metadata:
 * a film being listed in TMDB says nothing about whether we may stream it.
 */
export const Availability = Object.freeze({
  FULL: "full", // an authorized full-length source is configured and usable
  TRAILER_ONLY: "trailer-only", // only a trailer exists
  NONE: "none", // no video of any kind
  UNAVAILABLE: "unavailable", // a source is configured but temporarily not usable (expired, offline)
  RESTRICTED: "restricted", // the provider refuses playback (region, licence window)
});

export const canWatchFull = (a) => a === Availability.FULL;

/**
 * Honest, user-facing copy for each state. For UNAVAILABLE, `reason` (see resolve.js) says why, in words that are
 * useful to a visitor and a site owner but never contain URLs, tokens or other internals.
 */
const UNAVAILABLE_COPY = {
  expired: { label: "Link expired", message: "The playback link for this film has expired. The site owner needs to refresh it." },
  invalid: { label: "Source misconfigured", message: "The video source for this film is set up incorrectly, so it can’t be played. The site owner needs to fix it." },
  config: { label: "Playback not set up", message: "Playback isn’t configured correctly on this site. The site owner needs to check its settings." },
  catalog: { label: "Film list unavailable", message: "We couldn’t load the list of films that can be streamed. Check your connection and try again." },
  timeout: { label: "Playback service timed out", message: "The playback service took too long to answer. Please try again in a moment." },
};

export function describeAvailability(availability, reason) {
  switch (availability) {
    case Availability.FULL:
      return { label: "Watch in full", message: "This film can be watched in full on Cinema." };
    case Availability.TRAILER_ONLY:
      return { label: "Trailer only", message: "The full film isn’t available to stream on Cinema. You can watch the trailer." };
    case Availability.UNAVAILABLE:
      return UNAVAILABLE_COPY[reason] || { label: "Temporarily unavailable", message: "The full film is temporarily unavailable. Please try again later." };
    case Availability.RESTRICTED:
      return { label: "Restricted", message: "The provider doesn’t allow this film to be played here." };
    default:
      return { label: "Not streaming", message: "The full film isn’t available to stream on Cinema." };
  }
}
