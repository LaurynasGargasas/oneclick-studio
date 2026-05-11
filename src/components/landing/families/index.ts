// Per-family scoped stylesheets.  Each preset's `css_family` resolves
// to one of these via `loadFamilyCss(...)`, which dynamically imports
// the matching CSS file so it lives in its own Vite chunk and isn't
// shipped in the initial JS bundle.

import type { CssFamily } from "@/lib/landingTypes";

const FAMILY_LOADERS: Record<NonNullable<CssFamily>, () => Promise<string>> = {
  advertorial: () =>
    import("./advertorial/styles.css?raw").then((m) => m.default),
  "ten-reasons": () =>
    import("./ten-reasons/styles.css?raw").then((m) => m.default),
  ranking: () => import("./ranking/styles.css?raw").then((m) => m.default),
};

// Cache resolved CSS so we don't re-fetch the chunk between editor
// mount and an export click.
const cache = new Map<NonNullable<CssFamily>, string>();

export async function loadFamilyCss(family: CssFamily): Promise<string | null> {
  if (!family) return null;
  const cached = cache.get(family);
  if (cached != null) return cached;
  const loader = FAMILY_LOADERS[family];
  if (!loader) return null;
  const css = await loader();
  cache.set(family, css);
  return css;
}
