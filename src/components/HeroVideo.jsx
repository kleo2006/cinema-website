import React, { useEffect, useRef, useState } from "react";

/** Resolved through PUBLIC_URL so it works at the domain root in development and under /movie-app on GitHub Pages. */
export const HERO_VIDEO_SRC = `${process.env.PUBLIC_URL || ""}/videos/cinema-background.mp4`;

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

/** Data Saver, or a 2G connection. Not every browser exposes this; when it is missing the video is allowed. */
function savesData() {
  const c = typeof navigator !== "undefined" ? navigator.connection : undefined;
  return Boolean(c && (c.saveData || /(^|-)2g$/.test(c.effectiveType || "")));
}

function prefersReducedMotion() {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(REDUCED_MOTION).matches;
}

/**
 * Decorative looping background. It stays invisible until the browser reports that frames are actually playing, so a blocked
 * autoplay, a decode error or a missing file simply leaves the movie backdrop underneath. Nothing is rendered at all (and
 * nothing downloaded) when the visitor prefers reduced motion or has asked to save data.
 */
export default function HeroVideo() {
  const ref = useRef(null);
  const [reduced, setReduced] = useState(prefersReducedMotion);
  const [failed, setFailed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const enabled = !reduced && !failed && !savesData();

  // Follow the OS setting if it changes while the page is open.
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return undefined;
    const mq = window.matchMedia(REDUCED_MOTION);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  // React does not reliably write the `muted` attribute, and autoplay policies look at it, so set it on the element itself.
  // The video is paused while the hero is scrolled out of view.
  useEffect(() => {
    const video = ref.current;
    if (!enabled || !video) return undefined;
    video.defaultMuted = true;
    video.muted = true;
    const play = () => {
      const attempt = video.play?.();
      if (attempt && typeof attempt.catch === "function") attempt.catch(() => {});
    };
    if (typeof IntersectionObserver === "undefined") {
      play();
      return undefined;
    }
    const io = new IntersectionObserver(([entry]) => (entry.isIntersecting ? play() : video.pause?.()), { threshold: 0.01 });
    io.observe(video);
    return () => io.disconnect();
  }, [enabled]);

  if (!enabled) return null;
  return (
    <video
      ref={ref}
      className={`hero-video${playing ? " is-playing" : ""}`}
      src={HERO_VIDEO_SRC}
      autoPlay
      muted
      loop
      playsInline
      preload="auto"
      tabIndex={-1}
      aria-hidden="true"
      data-testid="hero-video"
      disablePictureInPicture
      disableRemotePlayback
      onPlaying={() => setPlaying(true)}
      onError={() => setFailed(true)}
    />
  );
}
