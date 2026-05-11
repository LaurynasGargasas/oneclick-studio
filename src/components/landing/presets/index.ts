// Landing-page presets — verbatim article-body HTML extracted from the
// 5 reference Shopify advertorials/listicles.  Each preset's HTML is
// loaded lazily on first use (via dynamic import) so the initial JS
// bundle isn't carrying ~1.5 MB of inert preset content.  Thumbnails
// are hardcoded URLs that point at the Shopify CDN — no decoding of
// the HTML at startup.

import type { LandingDocument, CssFamily } from "@/lib/landingTypes";

export type PresetFamily =
  | "advertorial-story"
  | "crisis-problem"
  | "ranking-listicle"
  | "ten-reasons-listicle"
  | "blank";

export interface Preset {
  id: string;
  name: string;
  family: PresetFamily;
  css_family: CssFamily;
  description: string;
  source_url?: string;
  thumbnail_src?: string;
  is_user?: boolean;                   // user-saved presets get this flag
  loadHtml: () => Promise<string>;
}

// ── lazy HTML loaders ────────────────────────────────────────────────
// Each `import('./html/X.html?raw')` is emitted as its own Vite chunk;
// the runtime caches it so subsequent calls return immediately.

const loadAdvertorialLongevity = () =>
  import("./html/advertorial-longevity.html?raw").then((m) => m.default);
const loadCrisisPfas = () =>
  import("./html/crisis-pfas.html?raw").then((m) => m.default);
const loadRankingTop5 = () =>
  import("./html/ranking-top5.html?raw").then((m) => m.default);
const loadTenReasonsPan = () =>
  import("./html/ten-reasons-pan.html?raw").then((m) => m.default);
const loadTenReasonsBoard = () =>
  import("./html/ten-reasons-board.html?raw").then((m) => m.default);

const BLANK_HTML = `<article style="max-width:720px;margin:60px auto;padding:0 24px;font-family:'Poppins',system-ui,sans-serif;">
  <h1 style="font-size:42px;line-height:1.15;margin:0 0 24px;font-weight:800;">Your Headline Here</h1>
  <p style="font-size:18px;line-height:1.7;color:#475569;">Start writing your landing page here.  Click any text to edit it inline.  Drop an image onto any &lt;img&gt; to replace it.  Export when you're done.</p>
</article>`;

const loadBlank = () => Promise.resolve(BLANK_HTML);

// Pre-resolved Shopify CDN URLs.  Cheaper than scraping each HTML at
// startup and survives lazy-loading (the picker needs the thumbnail
// before the user picks the preset).
const THUMB = {
  advertorialLongevity:
    "https://kitchensafetyinstitute.org/cdn/shop/files/HERO_IMAGE_AS_SEEN_ON_3.png?v=1775128397&width=1800",
  crisisPfas:
    "https://kitchensafetyinstitute.org/cdn/shop/files/final_advertorial_-0_min.jpg?v=1774292378&width=1800",
  rankingTop5:
    "https://best-kitchenfinds.com/cdn/shop/files/last_main.jpg?v=1774378743&width=2000",
  tenReasonsPan:
    "https://taimatitanium.com/cdn/shop/files/pc_fixed_mian.jpg?v=1760791772&width=3000",
  tenReasonsBoard:
    "https://taimatitanium.com/cdn/shop/files/main_doc_approved-min.jpg?v=1759946365&width=1200",
} as const;

export const PRESETS: Preset[] = [
  {
    id: "blank",
    name: "Blank Page",
    family: "blank",
    css_family: null,
    description:
      "Start from scratch.  One headline and one paragraph; build out from there.",
    loadHtml: loadBlank,
  },
  {
    id: "advertorial-longevity",
    name: "Advertorial — Personal Story",
    family: "advertorial-story",
    css_family: "advertorial",
    description:
      "Long-form personal narrative (Japanese longevity / Okinawa).  Best for storytelling-led brands and trust-driven niches.",
    source_url:
      "https://kitchensafetyinstitute.org/pages/longevity-secret-article",
    thumbnail_src: THUMB.advertorialLongevity,
    loadHtml: loadAdvertorialLongevity,
  },
  {
    id: "crisis-pfas",
    name: "Crisis Exposé",
    family: "crisis-problem",
    css_family: "advertorial",
    description:
      'Crisis-led advertorial ("Silent public health crisis").  Pairs scientific authority with strong urgency for problem-aware audiences.',
    source_url: "https://kitchensafetyinstitute.org/pages/pfas-health-crisis",
    thumbnail_src: THUMB.crisisPfas,
    loadHtml: loadCrisisPfas,
  },
  {
    id: "ranking-top5",
    name: "Top-5 Ranking Listicle",
    family: "ranking-listicle",
    css_family: "ranking",
    description:
      "Comparison-driven ranking listicle.  Anchored by a feature-matrix table and 5 ranked items with pros/cons.",
    source_url:
      "https://best-kitchenfinds.com/pages/top-5-safest-cookware",
    thumbnail_src: THUMB.rankingTop5,
    loadHtml: loadRankingTop5,
  },
  {
    id: "ten-reasons-pan",
    name: "10 Reasons — Viral Squeeze",
    family: "ten-reasons-listicle",
    css_family: "ten-reasons",
    description:
      '"10 Reasons Why X People Switched To…" listicle/squeeze hybrid.  Tight scarcity, heavy CTAs, FAQ accordions per reason.',
    source_url:
      "https://taimatitanium.com/pages/viral-titanium-pan-special-offer-1",
    thumbnail_src: THUMB.tenReasonsPan,
    loadHtml: loadTenReasonsPan,
  },
  {
    id: "ten-reasons-board",
    name: "10 Reasons — Cutting Board Variant",
    family: "ten-reasons-listicle",
    css_family: "ten-reasons",
    description:
      "Same 10-reasons template, board copy variant.  Includes MP4 videos per reason and an animated countdown footer.",
    source_url: "https://taimatitanium.com/pages/article-best-board-2",
    thumbnail_src: THUMB.tenReasonsBoard,
    loadHtml: loadTenReasonsBoard,
  },
];

export function getPreset(id: string): Preset | undefined {
  return PRESETS.find((p) => p.id === id);
}

export async function clonePresetDoc(
  id: string,
): Promise<LandingDocument | null> {
  const p = getPreset(id);
  if (!p) return null;
  return docFromPreset(p);
}

export async function docFromPreset(p: Preset): Promise<LandingDocument> {
  const html = await p.loadHtml();
  return {
    html,
    meta: {
      preset_id: p.id,
      source_url: p.source_url,
      css_family: p.css_family,
    },
  };
}
