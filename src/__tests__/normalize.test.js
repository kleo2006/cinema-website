import { normalizeDetails, normalizeMovie, normalizePage, pickTrailer } from "../api/normalize";

test("a rating with zero votes is treated as absent, not as 0", () => {
  expect(normalizeMovie({ id: 1, title: "A", vote_average: 0, vote_count: 0 }).voteAverage).toBeNull();
  expect(normalizeMovie({ id: 1, title: "A", vote_average: 7.2, vote_count: 10 }).voteAverage).toBe(7.2);
});

test("invalid records are dropped, missing fields stay null", () => {
  expect(normalizeMovie({ title: "no id" })).toBeNull();
  const m = normalizeMovie({ id: 2, title: "  ", original_title: "Orig", release_date: "" });
  expect(m.title).toBe("Orig");
  expect(m.year).toBeNull();
  expect(m.posterPath).toBeNull();
  expect(normalizePage({ results: [{ id: 1 }, null, {}] }).results).toHaveLength(1);
});

test("TMDB pagination is capped at 500 pages", () => {
  expect(normalizePage({ page: 1, total_pages: 9999, results: [] }).totalPages).toBe(500);
});

test("only YouTube trailers with a sane key are accepted, and a teaser is never a trailer", () => {
  expect(pickTrailer({ results: [{ site: "YouTube", type: "Teaser", key: "abcdefghij" }] })).toBeNull();
  expect(pickTrailer({ results: [{ site: "Vimeo", type: "Trailer", key: "abcdefghij" }] })).toBeNull();
  expect(pickTrailer({ results: [{ site: "YouTube", type: "Trailer", key: "x\"><script>" }] })).toBeNull();
  expect(pickTrailer({ results: [{ site: "YouTube", type: "Trailer", key: "aaaaaaaaaa" }, { site: "YouTube", type: "Trailer", key: "bbbbbbbbbb", official: true }] }).key).toBe("bbbbbbbbbb");
});

test("details never claim playability; related excludes the film itself", () => {
  const d = normalizeDetails({ id: 5, title: "T", runtime: 0, recommendations: { results: [{ id: 5, title: "T" }, { id: 6, title: "U" }] }, credits: { crew: [{ job: "Director", name: "D" }] } });
  expect(d.runtime).toBeNull();
  expect(d.related.map((m) => m.id)).toEqual([6]);
  expect(d.director).toEqual(["D"]);
  expect(d).not.toHaveProperty("playable");
});
