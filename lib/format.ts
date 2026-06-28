/** Shared formatting utilities. */

export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]!);
}

export function pluralWins(n: number): string {
  return `${n} ${n === 1 ? "win" : "wins"}`;
}
