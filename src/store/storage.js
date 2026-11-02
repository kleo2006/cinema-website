import { useSyncExternalStore } from "react";

/**
 * Tiny persistent store on top of localStorage.
 * - Every storage access is guarded (private mode, blocked storage and quota errors are survivable).
 * - Stored data is validated on read, so malformed or outdated entries are dropped instead of crashing.
 * - Subscribers (including other tabs, via the `storage` event) are notified of changes.
 * Data lives only in this browser; nothing is synced across devices.
 */
export function createStore({ key, version = 1, validate, empty }) {
  const storageKey = `cinema:${key}:v${version}`;
  const listeners = new Set();
  let memory = null; // used when localStorage is unavailable
  let snapshot;
  let loaded = false;

  function read() {
    let raw = null;
    try {
      raw = window.localStorage.getItem(storageKey);
    } catch {
      return memory ?? empty();
    }
    if (raw == null) return empty();
    try {
      return validate(JSON.parse(raw));
    } catch {
      return empty();
    }
  }

  function get() {
    if (!loaded) {
      snapshot = read();
      loaded = true;
    }
    return snapshot;
  }

  function emit() {
    listeners.forEach((l) => l());
  }

  function set(next) {
    snapshot = next;
    loaded = true;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      memory = next; // keep working for this session
    }
    emit();
  }

  function subscribe(listener) {
    listeners.add(listener);
    const onStorage = (e) => {
      if (e.key === storageKey || e.key === null) {
        loaded = false;
        emit();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(listener);
      window.removeEventListener("storage", onStorage);
    };
  }

  const useStore = () => useSyncExternalStore(subscribe, get, get);

  /** Test helper: forget the cached snapshot so the next read hits storage. */
  function reset() {
    loaded = false;
    memory = null;
    emit();
  }

  return { get, set, subscribe, useStore, reset };
}
