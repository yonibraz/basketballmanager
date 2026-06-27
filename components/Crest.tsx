"use client";

import { useState } from "react";
import { asset } from "@/lib/asset";

/**
 * Renders a club crest from `public/assets/crests/<id>.png`, kept within a
 * square box (object-fit: contain) so logos of any aspect ratio align. If the
 * image is missing or fails to load, falls back to a monochrome monogram built
 * from the club's short code so the build never shows a broken image.
 */
export function Crest({
  id,
  short,
  size = 24,
  className,
}: {
  id: string;
  short?: string;
  size?: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const label = (short ?? id ?? "?").slice(0, 3).toUpperCase();

  if (failed || !id) {
    return (
      <span
        className={`crest crest-fallback ${className ?? ""}`}
        style={{ width: size, height: size, fontSize: Math.round(size * 0.34) }}
      >
        {label}
      </span>
    );
  }

  return (
    <span className={`crest ${className ?? ""}`} style={{ width: size, height: size }}>
      <img
        src={asset(`assets/crests/${id}.png`)}
        width={size}
        height={size}
        alt=""
        loading="lazy"
        draggable={false}
        onError={() => setFailed(true)}
      />
    </span>
  );
}
