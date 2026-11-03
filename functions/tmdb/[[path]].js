/**
 * Cloudflare Pages Function: same-origin proxy for the TMDB v3 API.
 *
 * Why: some Wi-Fi networks / ISPs / DNS resolvers block api.themoviedb.org, so the browser's fetch fails and the app
 * shows "You appear to be offline" even though the device is online. Calling your own domain avoids that, and the API key
 * stays on the server instead of being shipped in the JavaScript bundle.
 *
 * Setup: Pages project -> Settings -> Variables and Secrets -> add TMDB_API_KEY (v3 key, as a Secret).
 * Build with REACT_APP_TMDB_BASE_URL=/tmdb and leave REACT_APP_API_KEY empty.
 */
const UPSTREAM = "https://api.themoviedb.org/3";
// Only the endpoints the app uses.
const ALLOWED = /^(trending\/movie\/(day|week)|movie\/(popular|top_rated|upcoming|now_playing|\d+)|discover\/movie|search\/movie|genre\/movie\/list)$/;

export async function onRequestGet({ request, env, params, waitUntil }) {
  const path = Array.isArray(params.path) ? params.path.join("/") : params.path || "";
  if (!ALLOWED.test(path)) return new Response("Not found", { status: 404 });
  if (!env.TMDB_API_KEY) return new Response("TMDB_API_KEY is not set on this Pages project", { status: 500 });

  const incoming = new URL(request.url);
  const upstream = new URL(`${UPSTREAM}/${path}`);
  incoming.searchParams.forEach((v, k) => {
    if (k !== "api_key") upstream.searchParams.set(k, v);
  });
  upstream.searchParams.set("api_key", env.TMDB_API_KEY);

  // Cache on the public URL (which never contains the key) for 5 minutes at the edge.
  const cache = caches.default;
  const cacheKey = new Request(incoming.toString(), { method: "GET" });
  const hit = await cache.match(cacheKey);
  if (hit) return hit;

  let res;
  try {
    res = await fetch(upstream.toString(), { headers: { Accept: "application/json" } });
  } catch {
    return new Response("Upstream unreachable", { status: 502 });
  }
  const out = new Response(res.body, { status: res.status, headers: { "Content-Type": res.headers.get("Content-Type") || "application/json" } });
  if (res.ok) {
    out.headers.set("Cache-Control", "public, max-age=300");
    waitUntil(cache.put(cacheKey, out.clone()));
  } else if (res.status === 429) {
    const ra = res.headers.get("Retry-After");
    if (ra) out.headers.set("Retry-After", ra);
  }
  return out;
}