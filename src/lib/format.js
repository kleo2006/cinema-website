export function formatRuntime(minutes) {
  if (!Number.isFinite(minutes) || minutes <= 0) return null;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (!h) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function formatClock(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

export function formatDate(iso) {
  if (!iso) return null;
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

export const formatRating = (v) => (Number.isFinite(v) ? v.toFixed(1) : null);

export const formatCount = (n) => (Number.isFinite(n) ? n.toLocaleString("en-US") : null);

/** Builds a stable, readable URL path: /movie/603-the-matrix */
export function slugify(title) {
  return (title || "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export const moviePath = (movie) => {
  const slug = slugify(movie.title);
  return `/movie/${movie.id}${slug ? `-${slug}` : ""}`;
};

export const watchPath = (id) => `/watch/${id}`;

/** Extracts the numeric id from "603" or "603-the-matrix". Returns null when invalid. */
export function parseMovieParam(param) {
  const match = /^(\d{1,9})(?:-[\w-]*)?$/.exec(param || "");
  return match ? Number(match[1]) : null;
}
