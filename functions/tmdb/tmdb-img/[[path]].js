/**
 * Optional Cloudflare Pages Function: same-origin proxy for TMDB artwork (image.tmdb.org/t/p/...).
 * Only needed if image.tmdb.org is ALSO blocked on the affected network. Every image counts as a Function request
 * (free plan: 100k/day), so leave REACT_APP_IMAGE_BASE_URL unset unless you need it.
 */
export async function onRequestGet({ request, params, waitUntil }) {
  const path = Array.isArray(params.path) ? params.path.join("/") : params.path || "";
  // e.g. w342/abc123.jpg or original/abc123.jpg
  if (!/^(w\d{2,4}|original)\/[\w.-]+$/.test(path)) return new Response("Not found", { status: 404 });

  const cache = caches.default;
  const cacheKey = new Request(request.url, { method: "GET" });
  const hit = await cache.match(cacheKey);
  if (hit) return hit;

  let res;
  try {
    res = await fetch(`https://image.tmdb.org/t/p/${path}`);
  } catch {
    return new Response("Upstream unreachable", { status: 502 });
  }
  if (!res.ok) return new Response("Not found", { status: res.status === 404 ? 404 : 502 });
  const out = new Response(res.body, {
    status: 200,
    headers: { "Content-Type": res.headers.get("Content-Type") || "image/jpeg", "Cache-Control": "public, max-age=31536000, immutable" },
  });
  waitUntil(cache.put(cacheKey, out.clone()));
  return out;
}