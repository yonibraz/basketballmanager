/**
 * Resolve a path under `public/` to a URL that works both in local dev and in
 * the static GitHub-Pages export (which is served under a repository subpath).
 *
 * CSS `url()` is already relative to the stylesheet and so is basePath-safe on
 * its own, but runtime `<img src>` is NOT — it must be prefixed with the same
 * basePath Next.js applies to routes. We read it from the public env var the
 * CI sets (`NEXT_PUBLIC_BASE_PATH`), which is inlined at build time.
 */
const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function asset(path: string): string {
  const clean = path.replace(/^\/+/, "");
  return `${BASE}/${clean}`;
}
