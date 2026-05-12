// Walks the editor canvas DOM and pulls every user-facing text node into
// a flat list of slots Claude can rewrite.  Each slot keeps a reference
// back to the DOM element so we can inject the rewritten text directly
// without re-parsing the HTML.
//
// We treat an element as a slot when it's a known text-bearing tag (or a
// plain div / span that contains only text) AND it has no block-level
// element descendants — i.e. it's the deepest container of a piece of
// copy.  Inline descendants like <strong>, <em>, <a> are allowed; on
// inject we set textContent which collapses them.  That's an accepted
// trade-off for v1 — the formatting toolbar can re-emphasize after.

const TEXT_TAGS = new Set([
  "H1", "H2", "H3", "H4", "H5", "H6",
  "P", "LI", "BUTTON", "BLOCKQUOTE", "FIGCAPTION", "SUMMARY",
  "A", "LABEL", "TD", "TH", "DT", "DD", "CAPTION",
]);

// Tags that count as inline / don't disqualify a parent from being a leaf.
const INLINE_TAGS = new Set([
  "A", "ABBR", "B", "BDI", "BDO", "BR", "CITE", "CODE", "DATA", "DEL",
  "DFN", "EM", "I", "INS", "KBD", "MARK", "Q", "RP", "RT", "RUBY", "S",
  "SAMP", "SMALL", "SPAN", "STRONG", "SUB", "SUP", "TIME", "U", "VAR",
  "WBR", "IMG", "PICTURE", "SOURCE", "BUTTON",
  // SVG content is inline-ish for our purposes.
  "SVG", "PATH", "G", "CIRCLE", "RECT", "LINE", "POLYGON", "POLYLINE",
  "ELLIPSE", "TEXT", "TSPAN", "USE", "DEFS", "FOREIGNOBJECT",
]);

const SKIP_TAGS = new Set([
  "SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "LINK", "META",
]);

export interface ExtractedSlot {
  id: string;
  tag: string;
  /** Short CSS-selector-like path for context (Claude infers role from it). */
  path: string;
  /** Current text content (verbatim). */
  current: string;
  /** Approximate length budget for the rewrite (1.5x current length, min 80). */
  max_chars: number;
}

export interface ExtractionResult {
  slots: ExtractedSlot[];
  nodeRefs: Map<string, HTMLElement>;
}

/** Walk the canvas and produce a flat slot list keyed by sequential IDs. */
export function extractSlots(root: HTMLElement): ExtractionResult {
  const slots: ExtractedSlot[] = [];
  const nodeRefs = new Map<string, HTMLElement>();
  let counter = 0;

  function isLeafTextElement(el: Element): boolean {
    // No element children at all → trivially leaf.
    if (el.children.length === 0) return el.textContent !== null && el.textContent.trim().length > 0;
    // Has children: leaf only if every child is an inline tag.
    for (const child of Array.from(el.children)) {
      if (!INLINE_TAGS.has(child.tagName)) return false;
    }
    return el.textContent !== null && el.textContent.trim().length > 0;
  }

  function isExtractable(el: Element): boolean {
    if (SKIP_TAGS.has(el.tagName)) return false;
    if (el.hasAttribute("data-lp-editor-only")) return false;
    // hidden inputs etc.
    if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") return false;
    return true;
  }

  function shortPath(el: Element): string {
    const parts: string[] = [];
    let cur: Element | null = el;
    let depth = 0;
    while (cur && cur !== root && depth < 4) {
      let part = cur.tagName.toLowerCase();
      const cls = cur.getAttribute("class");
      if (cls) {
        const first = cls.split(/\s+/).filter(Boolean)[0];
        if (first) part += `.${first}`;
      }
      parts.unshift(part);
      cur = cur.parentElement;
      depth += 1;
    }
    return parts.join(" > ");
  }

  function walk(el: Element) {
    if (!isExtractable(el)) return;

    // If this element is a known text-bearing tag AND is a leaf, claim it.
    // We also accept arbitrary leaf elements (div, span, etc.) that contain
    // only text — many preset blocks use raw <div>/<span> for copy.
    const isTextTag = TEXT_TAGS.has(el.tagName);
    const looksLeafy = isLeafTextElement(el);

    if (looksLeafy && (isTextTag || el.tagName === "DIV" || el.tagName === "SPAN")) {
      const text = (el.textContent ?? "").trim();
      if (text.length > 0) {
        const id = `s${counter++}`;
        slots.push({
          id,
          tag: el.tagName.toLowerCase(),
          path: shortPath(el),
          current: text,
          max_chars: Math.max(80, Math.ceil(text.length * 1.5)),
        });
        nodeRefs.set(id, el as HTMLElement);
        return;            // don't recurse into a claimed slot
      }
    }

    // Otherwise recurse into element children.
    for (const child of Array.from(el.children)) {
      walk(child);
    }
  }

  walk(root);
  return { slots, nodeRefs };
}

/** Apply rewritten text back to the DOM via stored node refs. */
export function applyRewrites(
  nodeRefs: Map<string, HTMLElement>,
  rewrites: Array<{ id: string; new_text: string }>,
): { applied: number; missing: string[] } {
  let applied = 0;
  const missing: string[] = [];
  for (const r of rewrites) {
    const node = nodeRefs.get(r.id);
    if (!node) {
      missing.push(r.id);
      continue;
    }
    // textContent collapses inline formatting (lost on rewrite — accepted
    // trade-off; the user can re-emphasize via the formatting toolbar).
    node.textContent = r.new_text;
    applied += 1;
  }
  return { applied, missing };
}
