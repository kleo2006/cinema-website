// Set REACT_APP_IMAGE_BASE_URL=/tmdb-img to serve artwork through your own domain (for networks that block image.tmdb.org).
const IMAGE_BASE = (process.env.REACT_APP_IMAGE_BASE_URL || "https://image.tmdb.org/t/p").replace(/\/$/, "");

const POSTER_WIDTHS = [154, 185, 342, 500, 780];
const BACKDROP_WIDTHS = [300, 780, 1280];
const PROFILE_WIDTHS = [45, 185];

const isPath = (p) => typeof p === "string" && /^\/[\w.-]+$/.test(p);

export const imageUrl = (path, size) => (isPath(path) ? `${IMAGE_BASE}/${size}${path}` : null);

function build(path, widths) {
  if (!isPath(path)) return { src: null, srcSet: undefined };
  const srcSet = widths.map((w) => `${IMAGE_BASE}/w${w}${path} ${w}w`).join(", ");
  return { srcSet, widths };
}

/** Poster image props. `fallbackWidth` is the plain src used by browsers without srcset. */
export function posterImage(path, fallbackWidth = 342) {
  const { srcSet } = build(path, POSTER_WIDTHS);
  return srcSet ? { src: imageUrl(path, `w${fallbackWidth}`), srcSet } : null;
}

export function backdropImage(path, { hero = false } = {}) {
  if (!isPath(path)) return null;
  const sets = BACKDROP_WIDTHS.map((w) => `${IMAGE_BASE}/w${w}${path} ${w}w`);
  // `original` is only offered to hero imagery so large displays stay sharp without penalising small ones.
  if (hero) sets.push(`${IMAGE_BASE}/original${path} 1920w`);
  return { src: imageUrl(path, "w1280"), srcSet: sets.join(", ") };
}

export function profileImage(path) {
  const { srcSet } = build(path, PROFILE_WIDTHS);
  return srcSet ? { src: imageUrl(path, "w185"), srcSet } : null;
}

export const POSTER_SIZES = "(min-width: 1440px) 190px, (min-width: 720px) 170px, 150px";