import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getGenres } from "../api/tmdb";

const GenresContext = createContext({ list: [], byId: new Map(), status: "loading" });
export const useGenres = () => useContext(GenresContext);

export function GenresProvider({ children }) {
  const [state, setState] = useState({ list: [], status: "loading" });
  useEffect(() => {
    let live = true;
    getGenres().then(
      (list) => live && setState({ list, status: "ready" }),
      () => live && setState({ list: [], status: "error" }),
    );
    return () => {
      live = false;
    };
  }, []);
  const value = useMemo(() => ({ ...state, byId: new Map(state.list.map((g) => [g.id, g.name])) }), [state]);
  return <GenresContext.Provider value={value}>{children}</GenresContext.Provider>;
}
