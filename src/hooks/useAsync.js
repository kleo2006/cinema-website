import { useCallback, useEffect, useState } from "react";

/**
 * Runs an async function whenever `deps` change. A result is applied only if it belongs to the
 * latest run, so a slow earlier request can never overwrite a newer one.
 */
export function useAsync(fn, deps) {
  const [state, setState] = useState({ status: "loading", data: null, error: null });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let live = true;
    setState((s) => (s.status === "loading" ? s : { status: "loading", data: null, error: null }));
    Promise.resolve()
      .then(fn)
      .then(
        (data) => live && setState({ status: "success", data, error: null }),
        (error) => live && setState({ status: "error", data: null, error }),
      );
    return () => {
      live = false;
    };
    // `fn` is intentionally excluded: callers pass an inline closure and list the values it reads in `deps`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { ...state, reload };
}
