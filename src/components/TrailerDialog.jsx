import React, { useEffect, useRef } from "react";
import { X } from "lucide-react";

/**
 * Trailer in a native <dialog>: focus is trapped, Escape closes and focus returns to the opener.
 * The embed is only created while open, so a closed dialog costs nothing.
 * Always labelled as a trailer — it is never presented as the film.
 */
export default function TrailerDialog({ trailer, title, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (trailer && !el.open) {
      if (typeof el.showModal === "function") el.showModal();
      else el.setAttribute("open", "");
    }
    if (!trailer && el.open) {
      if (typeof el.close === "function") el.close();
      else el.removeAttribute("open");
    }
    return undefined;
  }, [trailer]);

  const onClick = (e) => {
    if (e.target === ref.current) onClose(); // click on the backdrop
  };

  return (
    <dialog ref={ref} className="dialog" aria-labelledby="trailer-title" onClose={onClose} onClick={onClick}>
      {trailer && (
        <div className="dialog-body">
          <div className="dialog-head">
            <h2 id="trailer-title">
              Trailer · {title}
            </h2>
            <button type="button" className="btn btn-icon btn-ghost" onClick={onClose} aria-label="Close trailer">
              <X size={20} aria-hidden="true" />
            </button>
          </div>
          <div className="frame">
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(trailer.key)}?rel=0`}
              title={`${title} trailer`}
              allow="encrypted-media; picture-in-picture; fullscreen"
              referrerPolicy="strict-origin-when-cross-origin"
            />
          </div>
          <p className="dialog-note">This is a trailer, not the full film.</p>
        </div>
      )}
    </dialog>
  );
}
