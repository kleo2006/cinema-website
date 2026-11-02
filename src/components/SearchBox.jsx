import React, { useEffect, useId, useRef, useState } from "react";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { History, Search, X } from "lucide-react";
import { searchMovies } from "../api/tmdb";
import { useAsync } from "../hooks/useAsync";
import { useDebounced } from "../hooks/useDebounced";
import { clearSearchHistory, rememberSearch, useSearchHistory } from "../store/searchHistory";
import { moviePath } from "../lib/format";

const MIN_CHARS = 2;
const MAX_SUGGESTIONS = 6;

/**
 * Search field with suggestions (ARIA 1.2 combobox). Submitting goes to /search?q=…, which is shareable.
 * Suggestions are debounced and a stale response can never replace a newer one (see useAsync).
 */
export default function SearchBox({ className = "", autoFocus = false }) {
  const uid = useId();
  const listId = `${uid}-list`;
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const urlQuery = location.pathname === "/search" ? params.get("q") || "" : "";
  const [value, setValue] = useState(urlQuery);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const wrap = useRef(null);
  const history = useSearchHistory();

  useEffect(() => setValue(urlQuery), [urlQuery]);

  const trimmed = value.trim();
  const debounced = useDebounced(trimmed, 250);
  const wants = open && debounced.length >= MIN_CHARS && debounced === trimmed;
  const { status, data } = useAsync(() => (wants ? searchMovies(debounced) : Promise.resolve(null)), [wants, debounced]);
  const suggestions = wants && status === "success" && data ? data.results.slice(0, MAX_SUGGESTIONS) : [];
  const showHistory = open && !trimmed && history.length > 0;
  const options = showHistory
    ? history.map((q) => ({ key: `h-${q}`, label: q, run: () => go(q), recent: true }))
    : suggestions.map((m) => ({ key: m.id, label: m.title, hint: m.year, run: () => { setOpen(false); navigate(moviePath(m)); } }));
  const expanded = open && (options.length > 0 || (wants && status === "loading") || (wants && status === "success" && !suggestions.length));

  useEffect(() => setActive(-1), [debounced, showHistory]);

  useEffect(() => {
    const onDown = (e) => {
      if (wrap.current && !wrap.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, []);

  function go(query) {
    const q = query.trim();
    if (!q) return;
    rememberSearch(q);
    setValue(q);
    setOpen(false);
    navigate(`/search?q=${encodeURIComponent(q)}`);
  }

  const onKeyDown = (e) => {
    if (e.key === "ArrowDown" && options.length) {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (i + 1) % options.length);
    } else if (e.key === "ArrowUp" && options.length) {
      e.preventDefault();
      setActive((i) => (i <= 0 ? options.length - 1 : i - 1));
    } else if (e.key === "Escape") {
      if (open) {
        e.preventDefault();
        setOpen(false);
      } else if (value) setValue("");
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (active >= 0 && options[active]) options[active].run();
      else go(value);
    }
  };

  return (
    <div className={`searchbox ${className}`} ref={wrap}>
      <form role="search" onSubmit={(e) => { e.preventDefault(); go(value); }}>
        <label htmlFor={`${uid}-input`} className="sr-only">Search films</label>
        <Search className="searchbox-icon" size={18} aria-hidden="true" />
        <input
          id={`${uid}-input`}
          type="search"
          role="combobox"
          aria-expanded={expanded}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${uid}-opt-${active}` : undefined}
          placeholder="Search films"
          autoComplete="off"
          enterKeyHint="search"
          maxLength={100}
          autoFocus={autoFocus}
          value={value}
          onChange={(e) => { setValue(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
        {value && (
          <button type="button" className="searchbox-clear" aria-label="Clear search" onClick={() => { setValue(""); setOpen(true); document.getElementById(`${uid}-input`)?.focus(); }}>
            <X size={16} aria-hidden="true" />
          </button>
        )}
      </form>
      <div className="suggest" id={listId} role="listbox" aria-label={showHistory ? "Recent searches" : "Suggestions"} hidden={!expanded}>
        {options.map((o, i) => (
          <div key={o.key} id={`${uid}-opt-${i}`} role="option" aria-selected={i === active} className={`suggest-item${i === active ? " is-active" : ""}`} onPointerDown={(e) => e.preventDefault()} onClick={o.run}>
            {o.recent ? <History size={16} aria-hidden="true" /> : <Search size={16} aria-hidden="true" />}
            <span className="suggest-label">{o.label}</span>
            {o.hint && <span className="suggest-hint">{o.hint}</span>}
          </div>
        ))}
        {showHistory && (
          <button type="button" className="suggest-clear" onClick={() => { clearSearchHistory(); setOpen(false); }}>
            Clear recent searches
          </button>
        )}
        {wants && status === "loading" && <p className="suggest-note">Searching…</p>}
        {wants && status === "success" && !suggestions.length && <p className="suggest-note">No films match “{debounced}”.</p>}
      </div>
    </div>
  );
}
