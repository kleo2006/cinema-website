import { formatClock, formatRuntime, moviePath, parseMovieParam, slugify, formatRating } from "../lib/format";

test("formatRuntime", () => {
  expect(formatRuntime(135)).toBe("2h 15m");
  expect(formatRuntime(120)).toBe("2h");
  expect(formatRuntime(45)).toBe("45m");
  expect(formatRuntime(0)).toBeNull();
  expect(formatRuntime(undefined)).toBeNull();
});

test("formatClock", () => {
  expect(formatClock(65)).toBe("1:05");
  expect(formatClock(3725)).toBe("1:02:05");
  expect(formatClock(-3)).toBe("0:00");
  expect(formatClock(NaN)).toBe("0:00");
});

test("movie paths are stable and parse back to the id", () => {
  const path = moviePath({ id: 603, title: "The Matrix: Reloaded!" });
  expect(path).toBe("/movie/603-the-matrix-reloaded");
  expect(parseMovieParam("603-the-matrix-reloaded")).toBe(603);
  expect(parseMovieParam("603")).toBe(603);
  expect(moviePath({ id: 7, title: "中文" })).toBe("/movie/7");
});

test("parseMovieParam rejects junk", () => {
  for (const bad of ["abc", "", "-5", "12345678901", "1/../2", "1 x", null]) expect(parseMovieParam(bad)).toBeNull();
});

test("slugify strips accents", () => expect(slugify("Amélie")).toBe("amelie"));
test("a missing rating stays missing", () => expect(formatRating(null)).toBeNull());
