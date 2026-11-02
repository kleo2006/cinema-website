import { createStore } from "./storage";

const MAX = 6;

export const validateHistory = (data) =>
  Array.isArray(data) ? [...new Set(data.filter((q) => typeof q === "string" && q.trim()).map((q) => q.trim().slice(0, 100)))].slice(0, MAX) : [];

export const searchHistoryStore = createStore({ key: "searches", validate: validateHistory, empty: () => [] });
export const useSearchHistory = () => searchHistoryStore.useStore();

export function rememberSearch(query) {
  const q = (query || "").trim().slice(0, 100);
  if (!q) return;
  const rest = searchHistoryStore.get().filter((x) => x.toLowerCase() !== q.toLowerCase());
  searchHistoryStore.set([q, ...rest].slice(0, MAX));
}

export const clearSearchHistory = () => searchHistoryStore.set([]);
