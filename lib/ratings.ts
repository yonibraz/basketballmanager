import type { Player } from "@/src/types";
import { isForeign } from "@/src/rosters/quotas";

/** 1–99 style overall rating for display (maps the 1–20 attribute scale up). */
export function overall(p: Player): number {
  const a = p.attributes;
  const core =
    (a.shootingInside + a.shootingOutside + a.playmaking + a.defPerimeter + a.defInterior + a.rebounding + a.bballIq) / 7;
  return Math.round(35 + core * 3.1);
}

/** Format elapsed seconds-from-tipoff into a Q label + game clock. */
export function gameClock(period: number, clock: number): { quarter: string; mmss: string } {
  const periodLen = period <= 4 ? 600 : 300;
  const start = period <= 4 ? (period - 1) * 600 : 2400 + (period - 5) * 300;
  const remaining = Math.max(0, periodLen - (clock - start));
  const mm = Math.floor(remaining / 60);
  const ss = remaining % 60;
  const quarter = period <= 4 ? `Q${period}` : `OT${period - 4}`;
  return { quarter, mmss: `${mm}:${String(ss).padStart(2, "0")}` };
}

export { isForeign };
