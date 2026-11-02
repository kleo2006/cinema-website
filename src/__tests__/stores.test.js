import { addToWatchlist, isInWatchlist, removeFromWatchlist, toggleWatchlist, validateWatchlist, watchlistStore } from "../store/watchlist";
import { clearProgress, continueWatchingList, getProgress, progressStore, saveProgress, validateProgress } from "../store/progress";
import { rememberSearch, searchHistoryStore } from "../store/searchHistory";

beforeEach(() => {
  localStorage.clear();
  [watchlistStore, progressStore, searchHistoryStore].forEach((s) => s.reset());
});

const film = { id: 10, title: "Ten", posterPath: "/p.jpg", releaseDate: "2020-01-01", voteAverage: 7 };

describe("watchlist", () => {
  test("add, no duplicates, remove, persist", () => {
    expect(addToWatchlist(film)).toBe(true);
    expect(addToWatchlist(film)).toBe(false);
    expect(watchlistStore.get()).toHaveLength(1);
    expect(JSON.parse(localStorage.getItem("cinema:watchlist:v1"))).toHaveLength(1);
    expect(toggleWatchlist(film)).toBe(false);
    expect(isInWatchlist(watchlistStore.get(), 10)).toBe(false);
    expect(removeFromWatchlist(10)).toBe(false);
  });
  test("malformed storage is survivable", () => {
    localStorage.setItem("cinema:watchlist:v1", "{{{");
    watchlistStore.reset();
    expect(watchlistStore.get()).toEqual([]);
    expect(validateWatchlist([{ id: 1, title: "a" }, { id: 1, title: "dup" }, { id: "2", title: "x" }, null, 5])).toHaveLength(1);
  });
  test("still works when localStorage throws", () => {
    const spy = jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("quota"); });
    expect(addToWatchlist(film)).toBe(true);
    expect(watchlistStore.get()).toHaveLength(1);
    spy.mockRestore();
  });
});

describe("progress", () => {
  test("saves meaningful positions and lists them for Continue watching", () => {
    expect(saveProgress(film, 600, 7200)).toBe("saved");
    expect(getProgress(10).position).toBe(600);
    expect(continueWatchingList(progressStore.get()).map((e) => e.id)).toEqual([10]);
  });
  test("insignificant or invalid positions never overwrite useful progress", () => {
    saveProgress(film, 600, 7200);
    expect(saveProgress(film, 3, 7200)).toBe("ignored");
    expect(saveProgress(film, NaN, 7200)).toBe("ignored");
    expect(saveProgress(film, -1, 7200)).toBe("ignored");
    expect(saveProgress(film, 99999, 7200)).toBe("ignored");
    expect(getProgress(10).position).toBe(600);
  });
  test("finishing the film removes it", () => {
    saveProgress(film, 600, 7200);
    expect(saveProgress(film, 7150, 7200)).toBe("completed");
    expect(getProgress(10)).toBeNull();
  });
  test("validation drops bad entries and ids", () => {
    const v = validateProgress({ 1: { position: 50, duration: 100 }, x: { position: 5 }, 2: { position: -1 }, 3: { position: 500, duration: 100 }, 4: "s" });
    expect(Object.keys(v)).toEqual(["1"]);
  });
  test("clearProgress", () => {
    saveProgress(film, 600, 7200);
    clearProgress(10);
    expect(getProgress(10)).toBeNull();
  });
});

test("search history is de-duplicated case-insensitively and capped", () => {
  ["a", "b", "A", "c", "d", "e", "f", "g"].forEach(rememberSearch);
  const h = searchHistoryStore.get();
  expect(h[0]).toBe("g");
  expect(h).toHaveLength(6);
  expect(h.filter((q) => q.toLowerCase() === "a").length).toBeLessThanOrEqual(1);
});
