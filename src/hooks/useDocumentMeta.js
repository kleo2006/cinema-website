import { useEffect } from "react";
import { absoluteUrl } from "../config";

const SITE = "Cinema";

function setMeta(attr, key, content) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!content) {
    if (el) el.remove();
    return;
  }
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setCanonical(href) {
  let el = document.head.querySelector('link[rel="canonical"]');
  if (!href) {
    if (el) el.remove();
    return;
  }
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", "canonical");
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

/**
 * Page-specific title and social metadata. This is applied client-side, so crawlers that do not run
 * JavaScript only see the defaults in public/index.html (documented in the README).
 */
export function useDocumentMeta({ title, description, image, path, noindex = false, type = "website" }) {
  useEffect(() => {
    const fullTitle = title ? `${title} · ${SITE}` : `${SITE} — Discover and watch films`;
    document.title = fullTitle;
    const url = path ? absoluteUrl(path) : null;
    setMeta("name", "description", description);
    setMeta("name", "robots", noindex ? "noindex" : null);
    setMeta("property", "og:title", fullTitle);
    setMeta("property", "og:description", description);
    setMeta("property", "og:type", type);
    setMeta("property", "og:url", url);
    setMeta("property", "og:image", image || null);
    setMeta("name", "twitter:card", image ? "summary_large_image" : "summary");
    setMeta("name", "twitter:title", fullTitle);
    setMeta("name", "twitter:description", description);
    setMeta("name", "twitter:image", image || null);
    setCanonical(url);
  }, [title, description, image, path, noindex, type]);
}
