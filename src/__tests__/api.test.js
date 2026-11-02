import { ErrorKind } from "../api/errors";

const ORIGINAL = process.env;
let api;
const load = (env) => {
  jest.resetModules();
  process.env = { ...ORIGINAL, ...env };
  api = require("../api/tmdb");
};
afterAll(() => { process.env = ORIGINAL; });
const ok = (body) => ({ ok: true, status: 200, json: async () => body });

test("without a key or proxy, calls fail with a config error and never hit the network", async () => {
  load({ REACT_APP_API_KEY: "", REACT_APP_TMDB_BASE_URL: "" });
  global.fetch = jest.fn();
  await expect(api.getList("popular")).rejects.toMatchObject({ kind: ErrorKind.CONFIG });
  expect(fetch).not.toHaveBeenCalled();
});

test("identical concurrent requests share one network call; failures are not cached", async () => {
  load({ REACT_APP_API_KEY: "k", REACT_APP_TMDB_BASE_URL: "" });
  global.fetch = jest.fn().mockResolvedValue(ok({ results: [{ id: 1, title: "A" }], total_pages: 1, total_results: 1 }));
  await Promise.all([api.getList("popular"), api.getList("popular")]);
  expect(fetch).toHaveBeenCalledTimes(1);

  api.clearApiCache();
  global.fetch = jest.fn().mockResolvedValueOnce({ ok: false, status: 500, headers: new Headers() }).mockResolvedValueOnce(ok({ results: [] }));
  await expect(api.getList("top-rated")).rejects.toMatchObject({ kind: ErrorKind.SERVER });
  await expect(api.getList("top-rated")).resolves.toMatchObject({ results: [] });
});

test("status codes map to error kinds", async () => {
  load({ REACT_APP_API_KEY: "k" });
  for (const [status, kind] of [[401, ErrorKind.AUTH], [404, ErrorKind.NOT_FOUND], [429, ErrorKind.RATE_LIMIT]]) {
    api.clearApiCache();
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status, headers: new Headers() });
    await expect(api.getMovie(status)).rejects.toMatchObject({ kind });
  }
  api.clearApiCache();
  global.fetch = jest.fn().mockRejectedValue(new TypeError("offline"));
  await expect(api.getMovie(1)).rejects.toMatchObject({ kind: ErrorKind.NETWORK });
});

test("search trims, skips empty queries and sends the query as a safe parameter", async () => {
  load({ REACT_APP_API_KEY: "k" });
  global.fetch = jest.fn().mockResolvedValue(ok({ results: [] }));
  expect((await api.searchMovies("   ")).totalResults).toBe(0);
  expect(fetch).not.toHaveBeenCalled();
  await api.searchMovies(" a&b=c#<x> ");
  const url = new URL(fetch.mock.calls[0][0]);
  expect(url.searchParams.get("query")).toBe("a&b=c#<x>");
  expect(url.searchParams.get("include_adult")).toBe("false");
});

test("discover maps filters to documented TMDB parameters", async () => {
  load({ REACT_APP_API_KEY: "k" });
  global.fetch = jest.fn().mockResolvedValue(ok({ results: [] }));
  await api.discoverMovies({ genre: "27", year: "1999", minRating: "7", sort: "vote_average.desc", status: "released" });
  const p = new URL(fetch.mock.calls[0][0]).searchParams;
  expect(p.get("with_genres")).toBe("27");
  expect(p.get("primary_release_year")).toBe("1999");
  expect(p.get("vote_average.gte")).toBe("7");
  expect(p.get("sort_by")).toBe("vote_average.desc");
  expect(p.get("vote_count.gte")).toBe("300");
  expect(p.get("primary_release_date.lte")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
});
