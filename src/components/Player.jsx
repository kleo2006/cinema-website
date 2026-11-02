import React, { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Play, RotateCcw } from "lucide-react";
import { Link } from "react-router-dom";
import { config } from "../config";
import { formatClock, moviePath } from "../lib/format";
import { getProgress, isResumable, saveProgress } from "../store/progress";
import { PlayerError, classifyHlsError, classifyMediaError, describePlayerError, detectSupport, isRetryable, pickSource, probeSourceStatus, startPosition } from "../playback/support";

const SAVE_EVERY_MS = 5000;
const SEEK_STEP = 10;
const MAX_NETWORK_RECOVERIES = 2;
const STALL_TIMEOUT_MS = 20000; // buffering this long without progress is treated as a network failure

/**
 * Full-length player for an *authorized* source that the catalogue/resolver already vetted.
 * Uses the browser's own controls (play, seek, volume, captions, fullscreen, keyboard) for reliability,
 * and adds the parts the browser doesn't give us: status, errors, retry, resume and progress saving.
 *
 * Props
 *  movie        { id, title, posterPath, backdropPath }
 *  playback     result of resolvePlayback() with availability "full"
 *  intent       "resume" (jump to saved position) | "prompt" (ask) | "start"
 *  autoplay     start playing once ready (the visitor just pressed Watch)
 *  session      ref ({ position, retries }) that outlives the player so a retry resumes where it broke and attempts are capped
 *  onRetry      re-resolve the source (fresh signed URL) — called by the Retry button
 *  endSlot      content shown when the film finishes
 */
export default function Player({ movie, playback, intent = "prompt", autoplay = false, session, onRetry, endSlot }) {
  const videoRef = useRef(null);
  const frameRef = useRef(null);
  const [phase, setPhase] = useState("loading"); // loading | ready | playing | paused | buffering | ended | error
  const [failure, setFailure] = useState(null);
  const [prompt, setPrompt] = useState(null); // saved position awaiting the visitor's choice
  const [attempts, setAttempts] = useState(0); // local re-attach counter (the dependency that re-runs the effect)
  const tracking = useRef(false); // progress is saved only once the film is loaded and the visitor has chosen where to start
  const lastSave = useRef(0);
  const recoveries = useRef(0);
  const directSrc = useRef(null); // URL of a source the browser loads itself (not through hls.js), for diagnosing failures
  const probe = useRef({ controller: null }); // the in-flight status check, if any; replaced on teardown
  const movieRef = useRef(movie);
  movieRef.current = movie;

  const persist = useCallback((video) => {
    const v = video || videoRef.current;
    if (!v || !tracking.current) return;
    if (session?.current && Number.isFinite(v.currentTime)) session.current.position = v.currentTime;
    saveProgress(movieRef.current, v.currentTime, v.duration);
  }, [session]);

  const fail = useCallback((kind) => {
    persist(); // remember where it broke so a retry continues from there
    tracking.current = false;
    setFailure(kind);
    setPhase("error");
  }, [persist]);

  // Attach the source. Everything created here is released in the cleanup.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;
    let cancelled = false;
    let hls = null;
    directSrc.current = null;
    tracking.current = false;
    setPhase("loading");
    setFailure(null);
    setPrompt(null);

    if (playback.expiresAt && playback.expiresAt <= Date.now()) {
      fail(PlayerError.EXPIRED);
      return undefined;
    }
    const choice = pickSource(playback.sources, detectSupport(video));
    if (!choice) {
      fail(PlayerError.UNSUPPORTED);
      return undefined;
    }

    if (choice.type === "hls" && !choice.native) {
      import("hls.js")
        .then(({ default: Hls }) => {
          if (cancelled) return;
          if (!Hls.isSupported()) {
            fail(PlayerError.UNSUPPORTED);
            return;
          }
          hls = new Hls({ enableWorker: true, maxBufferLength: 30 });
          hls.on(Hls.Events.ERROR, (_e, data) => {
            if (!data?.fatal || cancelled) return;
            const kind = classifyHlsError(data, Hls.ErrorTypes);
            if (kind === PlayerError.NETWORK && recoveries.current < MAX_NETWORK_RECOVERIES) {
              recoveries.current += 1;
              hls.startLoad();
            } else if (kind === PlayerError.DECODE && recoveries.current < 1) {
              recoveries.current += 1;
              hls.recoverMediaError();
            } else {
              fail(kind);
            }
          });
          hls.loadSource(choice.src);
          hls.attachMedia(video);
        })
        .catch(() => !cancelled && fail(PlayerError.UNKNOWN));
    } else {
      directSrc.current = choice.src;
      video.src = choice.src;
      video.load();
    }

    return () => {
      cancelled = true;
      // A late status answer must not fail a player that has since been replaced or closed: swapping the object
      // makes the `probe.current === check` guard below false for any check still in flight.
      probe.current.controller?.abort();
      probe.current = { controller: null };
      directSrc.current = null;
      persist(video);
      tracking.current = false;
      hls?.destroy();
      video.pause();
      video.removeAttribute("src");
      video.load(); // releases the network connection and decoder
    };
    // `attempts` re-attaches the same source after a retry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playback, attempts]);

  // Once metadata is known we can validate positions against the real duration.
  const onLoadedMetadata = () => {
    const v = videoRef.current;
    const remembered = startPosition(session?.current?.position, v.duration, 1);
    const saved = getProgress(movie.id);
    const resumable = saved && isResumable(saved.position, v.duration ?? saved.duration) ? saved.position : null;
    let wait = false;

    if (remembered) {
      v.currentTime = remembered; // coming back from a retry: continue exactly where it broke
    } else if (resumable && intent === "resume") {
      v.currentTime = startPosition(resumable, v.duration);
    } else if (resumable && intent === "prompt") {
      setPrompt(resumable);
      wait = true;
    }
    tracking.current = !wait;
    if (autoplay && !wait) v.play().catch(() => {}); // blocked autoplay just leaves it paused
  };

  const choose = (position) => {
    const v = videoRef.current;
    v.currentTime = startPosition(position, v.duration);
    tracking.current = true;
    setPrompt(null);
    v.play().catch(() => {});
  };

  const onTimeUpdate = () => {
    const now = Date.now();
    if (now - lastSave.current >= SAVE_EVERY_MS) {
      lastSave.current = now;
      persist();
    }
  };

  // Browsers often stay in "buffering" forever after a dropped connection without raising an error event.
  useEffect(() => {
    if (phase !== "buffering") return undefined;
    const timer = setTimeout(() => fail(PlayerError.NETWORK), STALL_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [phase, fail]);

  // Save when the tab is hidden or closed, because timeupdate won't fire again.
  useEffect(() => {
    const flush = () => persist();
    const onVisibility = () => document.visibilityState === "hidden" && flush();
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [persist]);

  // Lock-screen / media-key metadata.
  useEffect(() => {
    if (!("mediaSession" in navigator) || typeof window.MediaMetadata === "undefined") return undefined;
    try {
      navigator.mediaSession.metadata = new window.MediaMetadata({ title: movie.title });
    } catch {
      /* optional enhancement */
    }
    return () => {
      try {
        navigator.mediaSession.metadata = null;
      } catch {
        /* ignore */
      }
    };
  }, [movie.title]);

  const onError = () => {
    const v = videoRef.current;
    // With hls.js the error handler above owns failures; native errors apply to direct playback.
    const kind = classifyMediaError(v?.error);
    if (!kind) return;
    const src = directSrc.current;
    if (!src || (kind !== PlayerError.SOURCE && kind !== PlayerError.NETWORK)) {
      fail(kind);
      return;
    }
    // The element only says "couldn't load". Ask the host why, so an expired link (403/410) or a refusal (451)
    // is explained as such instead of as a generic failure. No answer simply keeps the generic kind.
    const check = { controller: typeof AbortController === "undefined" ? null : new AbortController() };
    probe.current.controller?.abort();
    probe.current = check;
    probeSourceStatus(src, { signal: check.controller?.signal }).then((refined) => {
      if (probe.current === check) fail(refined || kind);
    });
  };

  const retry = () => {
    persist();
    if (session?.current) session.current.retries += 1;
    recoveries.current = 0;
    if (onRetry) onRetry();
    else setAttempts((n) => n + 1);
  };

  const onKeyDown = (e) => {
    const v = videoRef.current;
    if (!v || (e.target !== v && e.target !== frameRef.current) || e.altKey || e.ctrlKey || e.metaKey) return;
    // Space and the arrow keys are handled by the browser's own controls; doubling them up would cancel them out.
    const key = e.key.toLowerCase();
    if (key === "k") {
      e.preventDefault();
      if (v.paused) v.play().catch(() => {});
      else v.pause();
    } else if (key === "j" || key === "l") {
      e.preventDefault();
      const delta = key === "j" ? -SEEK_STEP : SEEK_STEP;
      v.currentTime = Math.max(0, Math.min(v.duration || Infinity, v.currentTime + delta));
    } else if (key === "m") {
      e.preventDefault();
      v.muted = !v.muted;
    } else if (key === "f") {
      e.preventDefault();
      if (document.fullscreenElement) document.exitFullscreen?.();
      else (v.requestFullscreen || v.webkitEnterFullscreen)?.call(v);
    }
  };

  const failed = phase === "error";
  const copy = failure ? describePlayerError(failure) : null;
  const canRetry = failed && isRetryable(failure, session?.current?.retries ?? attempts, { canRefresh: Boolean(config.resolverUrl) });
  const busy = phase === "loading" || phase === "buffering";
  const subtitles = playback.subtitles || [];

  return (
    <div className="player" ref={frameRef} onKeyDown={onKeyDown} data-phase={phase}>
      <video
        ref={videoRef}
        className="player-video"
        controls
        playsInline
        preload="metadata"
        crossOrigin={subtitles.length ? "anonymous" : undefined}
        aria-label={`${movie.title} — full film`}
        hidden={failed}
        onLoadedMetadata={onLoadedMetadata}
        onCanPlay={() => setPhase((p) => (p === "loading" || p === "buffering" ? "ready" : p))}
        onPlaying={() => setPhase("playing")}
        onPause={(e) => {
          if (!e.currentTarget.ended) {
            setPhase((p) => (p === "error" ? p : "paused"));
            persist(e.currentTarget);
          }
        }}
        onWaiting={() => setPhase((p) => (p === "playing" || p === "ready" || p === "paused" ? "buffering" : p))}
        onSeeked={() => persist()}
        onEnded={(e) => {
          persist(e.currentTarget);
          setPhase("ended");
        }}
        onTimeUpdate={onTimeUpdate}
        onError={onError}
      >
        {subtitles.map((t, i) => (
          <track key={t.src} kind="subtitles" src={t.src} srcLang={t.lang} label={t.label} />
        ))}
      </video>

      {busy && (
        <div className="player-overlay player-overlay-passive" role="status">
          <div className="spinner" aria-hidden="true" />
          <span className="sr-only">{phase === "loading" ? "Loading film" : "Buffering"}</span>
        </div>
      )}

      {prompt != null && !failed && (
        <div className="player-overlay" role="group" aria-label="Continue watching">
          <div className="player-card">
            <p className="player-card-title">Pick up where you left off?</p>
            <p className="player-card-text">You stopped at {formatClock(prompt)}.</p>
            <div className="state-actions">
              <button type="button" className="btn btn-primary" onClick={() => choose(prompt)} autoFocus>
                <Play size={16} aria-hidden="true" />
                Resume at {formatClock(prompt)}
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => choose(0)}>
                <RotateCcw size={16} aria-hidden="true" />
                Start from the beginning
              </button>
            </div>
          </div>
        </div>
      )}

      {failed && (
        <div className="player-overlay player-overlay-error" role="alert">
          <div className="player-card">
            <AlertTriangle size={32} className="state-icon" aria-hidden="true" />
            <p className="player-card-title">{copy.title}</p>
            <p className="player-card-text">{copy.message}</p>
            <div className="state-actions">
              {canRetry && (
                <button type="button" className="btn btn-primary" onClick={retry}>
                  <RotateCcw size={16} aria-hidden="true" />
                  Try again
                </button>
              )}
              <Link className="btn btn-ghost" to={moviePath(movie)}>Back to details</Link>
            </div>
          </div>
        </div>
      )}

      {phase === "ended" && (
        <div className="player-overlay">
          <div className="player-card player-card-wide">
            <p className="player-card-title">That’s the end of {movie.title}</p>
            {endSlot}
            <div className="state-actions">
              <button type="button" className="btn btn-ghost" onClick={() => { const v = videoRef.current; v.currentTime = 0; setPhase("paused"); v.play().catch(() => {}); }}>
                <RotateCcw size={16} aria-hidden="true" />
                Watch again
              </button>
              <Link className="btn btn-ghost" to={moviePath(movie)}>Back to details</Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
