"use client";

import type { OffensiveFocus, Tactics } from "@/src/types";

function Slider({
  label,
  value,
  min,
  max,
  display,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  display: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="slider-block">
      <div className="slider-head">
        <span>{label}</span>
        <span className="v">{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

const FOCI: { key: OffensiveFocus; label: string }[] = [
  { key: "inside", label: "Inside" },
  { key: "balanced", label: "Balanced" },
  { key: "perimeter", label: "Perimeter" },
];

function paceLabel(v: number): string {
  if (v < 33) return "Slow";
  if (v < 66) return "Medium";
  return "Fast";
}
function pressLabel(v: number): string {
  if (v < 33) return "Sag off";
  if (v < 66) return "Standard";
  return "Full press";
}

export function TacticsBoard({
  tactics,
  onChange,
}: {
  tactics: Tactics;
  onChange: (t: Tactics) => void;
}) {
  const set = (patch: Partial<Tactics>) => onChange({ ...tactics, ...patch });

  return (
    <div className="screen">
      <h2>Tactics</h2>
      <div className="card">
        <Slider
          label="Tempo / Pace"
          value={tactics.pace}
          min={0}
          max={100}
          display={paceLabel(tactics.pace)}
          onChange={(v) => set({ pace: v })}
        />
        <Slider
          label="Pressing intensity"
          value={tactics.pressingIntensity}
          min={0}
          max={100}
          display={pressLabel(tactics.pressingIntensity)}
          onChange={(v) => set({ pressingIntensity: v })}
        />
        <Slider
          label="Star rotation"
          value={tactics.starRotation}
          min={0}
          max={100}
          display={`${tactics.starRotation}%`}
          onChange={(v) => set({ starRotation: v })}
        />

        <div className="slider-block" style={{ marginBottom: 0 }}>
          <div className="slider-head">
            <span>Offensive focus</span>
          </div>
          <div className="seg">
            {FOCI.map((f) => (
              <button
                key={f.key}
                className={tactics.offensiveFocus === f.key ? "active" : ""}
                onClick={() => set({ offensiveFocus: f.key })}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <p className="muted" style={{ fontSize: 12, padding: "0 4px" }}>
        Faster tempo means more possessions. Heavy pressing forces turnovers but
        concedes fouls and open looks. Star rotation concentrates minutes and
        shots on your best players — at the cost of fatigue late in games.
      </p>
    </div>
  );
}
