import React, { useState } from "react";
import { Film, User } from "lucide-react";
import { backdropImage, posterImage, profileImage, POSTER_SIZES } from "../api/images";

/** Poster with a reserved 2:3 box (no layout shift) and a readable fallback when the image is missing or fails. */
export function Poster({ path, title, priority = false, sizes = POSTER_SIZES }) {
  const [failed, setFailed] = useState(false);
  const image = posterImage(path);
  if (!image || failed) {
    return (
      <div className="poster poster-fallback" role="img" aria-label={`No poster available for ${title}`}>
        <Film size={28} aria-hidden="true" />
        <span>{title}</span>
      </div>
    );
  }
  return (
    <img
      className="poster"
      src={image.src}
      srcSet={image.srcSet}
      sizes={sizes}
      alt={`Poster for ${title}`}
      width="342"
      height="513"
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}

/** Decorative backdrop. Missing artwork simply leaves the gradient surface behind it. */
export function Backdrop({ path, hero = false, className = "" }) {
  const [failed, setFailed] = useState(false);
  const image = backdropImage(path, { hero });
  if (!image || failed) return <div className={`backdrop backdrop-empty ${className}`} aria-hidden="true" />;
  return (
    <img
      className={`backdrop ${className}`}
      src={image.src}
      srcSet={image.srcSet}
      sizes="100vw"
      alt=""
      width="1280"
      height="720"
      loading={hero ? "eager" : "lazy"}
      fetchpriority={hero ? "high" : undefined}
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}

export function Avatar({ path, name }) {
  const [failed, setFailed] = useState(false);
  const image = profileImage(path);
  if (!image || failed) {
    return (
      <div className="avatar avatar-fallback" aria-hidden="true">
        <User size={22} />
      </div>
    );
  }
  return <img className="avatar" src={image.src} srcSet={image.srcSet} sizes="72px" alt="" width="72" height="72" loading="lazy" decoding="async" onError={() => setFailed(true)} title={name} />;
}
