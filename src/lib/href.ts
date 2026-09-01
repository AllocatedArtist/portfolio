/**
 * Base-path aware link helpers.
 *
 * The site deploys to a GitHub *project* page, https://…github.io/portfolio/,
 * so every internal link needs the `/portfolio` prefix. Astro exposes that as
 * import.meta.env.BASE_URL, derived from `base` in astro.config.mjs.
 *
 * Do not hardcode a leading "/" in a link. It works in dev (where the base is
 * applied by the dev server) and 404s in production, which is the worst kind
 * of bug to catch. Route through withBase() instead.
 *
 * Both helpers no-op when base is "/", so moving to a user page later is a
 * one-line config change rather than a sweep through the codebase.
 */

/** "/portfolio" when based, "" at the root. Trailing slash stripped. */
const BASE = import.meta.env.BASE_URL.replace(/\/+$/, "");

/** True for anything we must not touch: absolute URLs, anchors, mailto, tel. */
function isExternal(path: string): boolean {
  return /^[a-z][a-z0-9+.-]*:/i.test(path) || path.startsWith("//") || path.startsWith("#");
}

/** Prefix an internal, root-relative path with the base. */
export function withBase(path: string): string {
  if (isExternal(path)) return path;
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${BASE}${p}`;
}

/**
 * Inverse of withBase, for comparing Astro.url.pathname against route
 * literals. In production the pathname arrives as "/portfolio/work"; route
 * config is written as "/work".
 */
export function stripBase(pathname: string): string {
  if (BASE && (pathname === BASE || pathname.startsWith(`${BASE}/`))) {
    return pathname.slice(BASE.length) || "/";
  }
  return pathname;
}
