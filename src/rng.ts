/**
 * Deterministic, seedable pseudo-random number generator.
 *
 * The match engine must be fully deterministic: the same inputs and the same
 * seed always produce the same box score and event stream. This is essential
 * for reproducible simulations, debugging, and unit testing. We therefore
 * never touch `Math.random()` anywhere in the simulation layer — all
 * randomness flows through an instance of {@link Rng}.
 *
 * Implementation: a `mulberry32` generator. It is small, fast, has a full
 * 2^32 period, and passes basic statistical tests — more than enough for a
 * game simulation while remaining trivial to reason about.
 */
export class Rng {
  private state: number;

  constructor(seed: number) {
    // Normalise the seed into an unsigned 32-bit integer so that callers may
    // pass any finite number (including hashes of strings) as a seed.
    this.state = seed >>> 0;
  }

  /** Returns the next float in the half-open interval [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Returns an integer in the inclusive range [min, max]. */
  int(min: number, max: number): number {
    if (max < min) throw new Error(`Rng.int: max (${max}) < min (${min})`);
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** Returns true with the supplied probability (clamped to [0, 1]). */
  chance(probability: number): boolean {
    return this.next() < clamp01(probability);
  }

  /**
   * Picks an index from a list of non-negative weights, proportional to each
   * weight. Throws if the weights sum to zero.
   */
  weightedIndex(weights: readonly number[]): number {
    let total = 0;
    for (const w of weights) {
      if (w < 0) throw new Error("Rng.weightedIndex: negative weight");
      total += w;
    }
    if (total <= 0) throw new Error("Rng.weightedIndex: weights sum to zero");

    let roll = this.next() * total;
    for (let i = 0; i < weights.length; i++) {
      roll -= weights[i]!;
      if (roll < 0) return i;
    }
    return weights.length - 1; // floating-point fallback
  }

  /** Picks an element from `items` using the parallel `weights` array. */
  weightedPick<T>(items: readonly T[], weights: readonly number[]): T {
    if (items.length !== weights.length) {
      throw new Error("Rng.weightedPick: items/weights length mismatch");
    }
    return items[this.weightedIndex(weights)]!;
  }
}

/** Clamps a value to the [0, 1] interval. */
export function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

/**
 * Hashes an arbitrary string into a 32-bit integer seed (FNV-1a). Useful for
 * deriving a stable seed from, say, a fixture id so that re-simulating the
 * same fixture yields the same result.
 */
export function seedFromString(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}
