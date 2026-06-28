"use client";
import { useEffect, useRef, useState } from "react";

export function AnimatedNumber({ value, className }: { value: number; className?: string }) {
  const [displayed, setDisplayed] = useState(value);
  const prevRef = useRef(value);

  useEffect(() => {
    const from = prevRef.current;
    const to = value;
    prevRef.current = value;
    if (from === to) return;

    // Quick count-up: run in ~200ms with rAF
    const start = performance.now();
    const duration = 180;
    let raf: number;

    function tick(now: number) {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      setDisplayed(Math.round(from + (to - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
      else setDisplayed(to);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return <span className={className}>{displayed}</span>;
}
