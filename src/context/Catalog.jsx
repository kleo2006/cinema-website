import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { loadCatalog } from "../playback/catalog";

const CatalogContext = createContext({ ready: false, error: null, reload: () => {}, ids: new Set(), has: () => false });
export const useCatalog = () => useContext(CatalogContext);

/**
 * Which titles have a configured full-length source. Used for badges and the "Full films" shelf.
 * `ready` means the catalogue was loaded and is valid (it may legitimately be empty). `error` means it could not be
 * loaded or is not a catalogue: the two are never conflated, and while it is unknown nothing is marked playable.
 */
export function CatalogProvider({ children }) {
  const [state, setState] = useState({ catalog: null, error: null });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    setState((s) => (s.error ? { catalog: null, error: null } : s)); // a retry shows loading again
    loadCatalog().then(
      (catalog) => live && setState({ catalog, error: null }),
      (error) => live && setState({ catalog: null, error }),
    );
    return () => {
      live = false;
    };
  }, [attempt]);
  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  const value = useMemo(() => {
    const playable = new Set();
    const now = Date.now();
    state.catalog?.forEach((entry, id) => {
      const expired = entry.expiresAt && entry.expiresAt <= now;
      if (entry.status === "available" && entry.sources.length && !expired) playable.add(id);
    });
    return { ready: state.catalog !== null, error: state.error, reload, ids: playable, has: (id) => playable.has(id) };
  }, [state, reload]);
  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}
