// Render a LandingDocument to a standalone HTML string.
//
// Output: HTML5 boilerplate + Google Fonts (Poppins, Open Sans) +
// family CSS + the document's article HTML.  Self-contained, no
// React-server rendering needed.  Async because the family CSS is
// dynamically imported.

import type { LandingDocument } from "@/lib/landingTypes";
import { loadFamilyCss } from "@/components/landing/families";

interface ExportOptions {
  title?: string;
}

export async function renderLandingHtml(
  doc: LandingDocument,
  opts: ExportOptions = {},
): Promise<string> {
  const title = opts.title ?? doc.meta?.page_title ?? "Landing Page";
  const family = doc.meta?.css_family ?? null;
  const familyCss = await loadFamilyCss(family);
  const familyAttr = family ? ` data-lp-family="${family}"` : "";
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;600;700&family=Poppins:wght@400;600;700;800&display=swap" />
<style>
  body { margin: 0; background: #fff; color: #0f172a; font-family: "Poppins", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
</style>
${familyCss ? `<style>${familyCss}</style>` : ""}
</head>
<body>
<main${familyAttr}>
${doc.html}
</main>
</body>
</html>
`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
