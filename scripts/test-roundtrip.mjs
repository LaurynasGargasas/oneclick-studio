// Round-trip test: load the advertorial-longevity preset, extract its
// slots, fake a set of rewrites (prefix each with "REWRITTEN: "), apply
// them, serialize, and assert that the serialized HTML reflects the
// rewrites.  If this passes, the bug is upstream (Claude returning
// bogus IDs or echoing).  If this fails, the bug is in
// extractSlots / applyRewrites / serializeCanvas.

import { readFileSync } from "node:fs";
import { Window } from "happy-dom";

const window = new Window();
globalThis.document = window.document;
globalThis.HTMLElement = window.HTMLElement;
globalThis.Element = window.Element;
globalThis.Node = window.Node;

// Load preset HTML — iterate every preset.
const PRESET_FILES = [
  "advertorial-longevity.html",
  "crisis-pfas.html",
  "ranking-top5.html",
  "ten-reasons-pan.html",
  "ten-reasons-board.html",
];

// Re-implement the relevant extract/apply/serialize functions inline
// (importing the .ts modules from a .mjs node script is annoying — and
// we want zero divergence risk in any case).

const TEXT_TAGS = new Set([
  "H1", "H2", "H3", "H4", "H5", "H6",
  "P", "LI", "BUTTON", "BLOCKQUOTE", "FIGCAPTION", "SUMMARY",
  "A", "LABEL", "TD", "TH", "DT", "DD", "CAPTION",
]);

const INLINE_TAGS = new Set([
  "A", "ABBR", "B", "BDI", "BDO", "BR", "CITE", "CODE", "DATA", "DEL",
  "DFN", "EM", "I", "INS", "KBD", "MARK", "Q", "RP", "RT", "RUBY", "S",
  "SAMP", "SMALL", "SPAN", "STRONG", "SUB", "SUP", "TIME", "U", "VAR",
  "WBR", "IMG", "PICTURE", "SOURCE", "BUTTON",
  "SVG", "PATH", "G", "CIRCLE", "RECT", "LINE", "POLYGON", "POLYLINE",
  "ELLIPSE", "TEXT", "TSPAN", "USE", "DEFS", "FOREIGNOBJECT",
]);

const SKIP_TAGS = new Set([
  "SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "LINK", "META",
]);

function extractSlots(root) {
  const slots = [];
  const nodeRefs = new Map();
  let counter = 0;

  function isLeafTextElement(el) {
    if (el.children.length === 0) return el.textContent !== null && el.textContent.trim().length > 0;
    for (const child of Array.from(el.children)) {
      if (!INLINE_TAGS.has(child.tagName)) return false;
    }
    return el.textContent !== null && el.textContent.trim().length > 0;
  }

  function isExtractable(el) {
    if (SKIP_TAGS.has(el.tagName)) return false;
    if (el.hasAttribute("data-lp-editor-only")) return false;
    if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") return false;
    return true;
  }

  function walk(el) {
    if (!isExtractable(el)) return;
    const isTextTag = TEXT_TAGS.has(el.tagName);
    const looksLeafy = isLeafTextElement(el);
    if (looksLeafy && (isTextTag || el.tagName === "DIV" || el.tagName === "SPAN")) {
      const text = (el.textContent ?? "").trim();
      if (text.length > 0) {
        const id = `s${counter++}`;
        slots.push({ id, tag: el.tagName.toLowerCase(), current: text, max_chars: Math.max(80, Math.ceil(text.length * 1.5)) });
        nodeRefs.set(id, el);
        return;
      }
    }
    for (const child of Array.from(el.children)) {
      walk(child);
    }
  }

  walk(root);
  return { slots, nodeRefs };
}

function applyRewrites(nodeRefs, rewrites) {
  let applied = 0;
  const missing = [];
  for (const r of rewrites) {
    const node = nodeRefs.get(r.id);
    if (!node) {
      missing.push(r.id);
      continue;
    }
    node.textContent = r.new_text;
    applied += 1;
  }
  return { applied, missing };
}

function serializeCanvas(canvas) {
  const clone = canvas.cloneNode(true);
  clone.querySelectorAll("[data-lp-editor-only]").forEach((n) => n.remove());
  clone.querySelectorAll("[data-lp-section]").forEach((el) => {
    el.removeAttribute("data-lp-section");
    el.removeAttribute("draggable");
  });
  clone.querySelectorAll("style").forEach((s) => {
    if (!s.textContent) return;
    const next = s.textContent.replace(
      /@container\s+(\(\s*(?:max|min)-width\s*:\s*[^)]+\))/g,
      "@media $1",
    );
    if (next !== s.textContent) s.textContent = next;
  });
  return clone.innerHTML;
}

// ── Run it ─────────────────────────────────────────────────────────────

let anyFailed = false;

for (const file of PRESET_FILES) {
  const html = readFileSync(
    new URL(`../src/components/landing/presets/html/${file}`, import.meta.url),
    "utf8",
  );

  const stage = document.createElement("div");
  stage.innerHTML = html;

  const { slots, nodeRefs } = extractSlots(stage);
  const fakeRewrites = slots.map((s) => ({ id: s.id, new_text: `__REWRITTEN_${s.id}__` }));
  const { applied, missing } = applyRewrites(nodeRefs, fakeRewrites);
  const serialized = serializeCanvas(stage);
  const matches = (serialized.match(/__REWRITTEN_s\d+__/g) ?? []).length;
  const ok = applied === slots.length && missing.length === 0 && matches === applied;
  if (!ok) anyFailed = true;
  const status = ok ? "✓" : "✗";
  console.log(
    `${status} ${file.padEnd(28)} slots=${String(slots.length).padStart(3)} applied=${applied} missing=${missing.length} markers=${matches}`,
  );
  if (!ok) {
    console.log(`  FIRST 3 SLOTS:`);
    for (const s of slots.slice(0, 3)) console.log(`    ${s.id} <${s.tag}>: "${s.current.slice(0, 60)}…"`);
    console.log(`  FIRST MISSING: ${missing.slice(0, 5).join(", ")}`);
  }
}

console.log("");
if (anyFailed) {
  console.log("✗ ONE OR MORE PRESETS FAILED THE ROUND-TRIP — extract/apply/serialize has a real bug");
  process.exit(1);
} else {
  console.log("✓ All 5 presets round-trip cleanly: extract → apply → serialize works.");
  process.exit(0);
}
