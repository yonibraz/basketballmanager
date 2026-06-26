import { describe, expect, it } from "vitest";
import { Rng, clamp01, seedFromString } from "../src/rng.js";

describe("Rng", () => {
  it("is deterministic for a given seed", () => {
    const a = new Rng(42);
    const b = new Rng(42);
    const seqA = Array.from({ length: 20 }, () => a.next());
    const seqB = Array.from({ length: 20 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it("produces different streams for different seeds", () => {
    const a = new Rng(1).next();
    const b = new Rng(2).next();
    expect(a).not.toEqual(b);
  });

  it("returns floats in [0, 1)", () => {
    const r = new Rng(7);
    for (let i = 0; i < 1000; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("int() respects inclusive bounds", () => {
    const r = new Rng(99);
    for (let i = 0; i < 1000; i++) {
      const v = r.int(3, 6);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(6);
      expect(Number.isInteger(v)).toBe(true);
    }
  });

  it("weightedIndex skews toward heavier weights", () => {
    const r = new Rng(123);
    const counts = [0, 0, 0];
    for (let i = 0; i < 6000; i++) counts[r.weightedIndex([1, 3, 6])]!++;
    expect(counts[2]!).toBeGreaterThan(counts[1]!);
    expect(counts[1]!).toBeGreaterThan(counts[0]!);
  });

  it("weightedIndex throws on zero-sum weights", () => {
    const r = new Rng(1);
    expect(() => r.weightedIndex([0, 0])).toThrow();
  });

  it("seedFromString is stable and 32-bit", () => {
    const s = seedFromString("fixture-123");
    expect(s).toEqual(seedFromString("fixture-123"));
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(0xffffffff);
  });

  it("clamp01 clamps", () => {
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(2)).toBe(1);
    expect(clamp01(0.5)).toBe(0.5);
  });
});
