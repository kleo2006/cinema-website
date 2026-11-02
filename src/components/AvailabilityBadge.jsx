import React from "react";
import { PlayCircle } from "lucide-react";

/** Shown only for titles with a configured full-length source, so it never overstates availability. */
export default function AvailabilityBadge({ className = "" }) {
  return (
    <span className={`badge badge-playable ${className}`}>
      <PlayCircle size={12} aria-hidden="true" />
      Full film
    </span>
  );
}
