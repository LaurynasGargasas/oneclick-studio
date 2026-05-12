// Per-family scoped stylesheets.  Each preset's `css_family` resolves
// to one of these via `loadFamilyCss(...)`, which dynamically imports
// the matching CSS file so it lives in its own Vite chunk and isn't
// shipped in the initial JS bundle.
//
// The editor consumes a container-query variant (`loadFamilyCssForEditor`)
// so that the mobile-preview toggle, which only narrows the canvas div,
// actually triggers the responsive breakpoints.  Exports use the raw
// `loadFamilyCss` which keeps the source `@media` queries intact — the
// exported HTML lives in a real browser whose viewport drives layout.

import type { CssFamily } from "@/lib/landingTypes";

const FAMILY_LOADERS: Record<NonNullable<CssFamily>, () => Promise<string>> = {
  advertorial: () =>
    import("./advertorial/styles.css?raw").then((m) => m.default),
  "ten-reasons": () =>
    import("./ten-reasons/styles.css?raw").then((m) => m.default),
  ranking: () => import("./ranking/styles.css?raw").then((m) => m.default),
};

// Cache resolved CSS in both raw and editor-transformed forms.
const rawCache = new Map<NonNullable<CssFamily>, string>();
const editorCache = new Map<NonNullable<CssFamily>, string>();

// Swap viewport-based width queries for container queries.  Match any
// `@media …(max-width|min-width: N)` (optionally preceded by `screen and`,
// `only screen and`) and rewrite to `@container (...)`.  We only touch
// the leading bit up to and including the width parenthesis; anything
// after (rare: extra `and (...)` features) is kept as-is.
function viewportToContainerQueries(css: string): string {
  return css.replace(
    /@media\b[^{]*?(\(\s*(?:max|min)-width\s*:\s*[^)]+\))/g,
    "@container $1",
  );
}

async function loadRaw(family: NonNullable<CssFamily>): Promise<string | null> {
  const cached = rawCache.get(family);
  if (cached != null) return cached;
  const loader = FAMILY_LOADERS[family];
  if (!loader) return null;
  const css = await loader();
  rawCache.set(family, css);
  return css;
}

/** Raw family CSS, suitable for embedding in exported HTML. */
export async function loadFamilyCss(family: CssFamily): Promise<string | null> {
  if (!family) return null;
  return loadRaw(family);
}

/** Editor variant: @media (width) queries rewritten to @container (width)
 *  so they fire on canvas width.  Use only inside the editor canvas (which
 *  sets `container-type: inline-size`). */
export async function loadFamilyCssForEditor(
  family: CssFamily,
): Promise<string | null> {
  if (!family) return null;
  const cached = editorCache.get(family);
  if (cached != null) return cached;
  const raw = await loadRaw(family);
  if (raw == null) return null;
  const transformed = viewportToContainerQueries(raw);
  editorCache.set(family, transformed);
  return transformed;
}
