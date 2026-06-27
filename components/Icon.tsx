"use client";

import type { CSSProperties, ReactNode } from "react";

/**
 * Minimal inline-SVG icon set (Lucide / Feather geometry, MIT-licensed) drawn
 * with `currentColor` so icons inherit the monochrome text colour. Replaces all
 * emoji used in the app chrome. No files / no basePath concerns.
 */

export type IconName =
  | "table"
  | "squad"
  | "tactics"
  | "play"
  | "pause"
  | "skip"
  | "trophy"
  | "check"
  | "x"
  | "chevronRight"
  | "ball";

// Stroked icons (fill:none, stroke:currentColor).
const STROKE: Partial<Record<IconName, ReactNode>> = {
  table: (
    <>
      <path d="M3 3v18h18" />
      <rect x="7" y="11" width="3" height="7" />
      <rect x="13" y="7" width="3" height="11" />
    </>
  ),
  squad: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  tactics: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12 3v3.5M12 17.5V21M3 12h3.5M17.5 12H21" />
    </>
  ),
  trophy: (
    <>
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </>
  ),
  check: <polyline points="20 6 9 17 4 12" />,
  x: (
    <>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </>
  ),
  chevronRight: <polyline points="9 18 15 12 9 6" />,
  ball: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3v18" />
      <path d="M5.6 5.6c3.5 2.4 9.3 2.4 12.8 0M5.6 18.4c3.5-2.4 9.3-2.4 12.8 0" />
    </>
  ),
};

// Filled icons (fill:currentColor, no stroke) — playback transport controls.
const FILL: Partial<Record<IconName, ReactNode>> = {
  play: <path d="M6 4.5v15l12-7.5z" />,
  pause: (
    <>
      <rect x="6" y="4.5" width="4" height="15" rx="1" />
      <rect x="14" y="4.5" width="4" height="15" rx="1" />
    </>
  ),
  skip: (
    <>
      <path d="M5 4.5v15l10-7.5z" />
      <rect x="16.5" y="4.5" width="2.6" height="15" rx="1" />
    </>
  ),
};

export function Icon({
  name,
  size = 18,
  strokeWidth = 1.9,
  style,
  className,
}: {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  style?: CSSProperties;
  className?: string;
}) {
  const filled = name in FILL;
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke={filled ? "none" : "currentColor"}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flex: "0 0 auto", display: "block", ...style }}
      aria-hidden="true"
    >
      {filled ? FILL[name] : STROKE[name]}
    </svg>
  );
}
