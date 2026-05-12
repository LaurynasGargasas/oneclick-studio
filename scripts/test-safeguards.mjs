// Verify the safeguards in anthropicClient.ts work as intended:
//   - estimateCost gives sensible numbers per preset
//   - pickPreviewSlots picks high-impact (h1/h2/cta/long-p) slots
//   - the echo detector correctly flags echoes and ignores rewrites
//
// We re-implement the small functions inline (same as test-roundtrip)
// because the .ts source can't be imported from a Node .mjs without a
// loader.  Keep these in sync with anthropicClient.ts.

import { readFileSync } from "node:fs";
import { Window } from "happy-dom";

const window = new Window();
globalThis.document = window.document;
globalThis.HTMLElement = window.HTMLElement;
globalThis.Element = window.Element;
globalThis.Node = window.Node;

// ── replicas of the extract walker (only what we need) ──────────────
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
const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "LINK", "META"]);

function extractSlots(root) {
  const slots = [];
  let counter = 0;
  function isLeafTextElement(el) {
    if (el.children.length === 0) return el.textContent !== null && el.textContent.trim().length > 0;
    for (const child of Array.from(el.children)) {
      if (!INLINE_TAGS.has(child.tagName)) return false;
    }
    return el.textContent !== null && el.textContent.trim().length > 0;
  }
  function walk(el) {
    if (SKIP_TAGS.has(el.tagName)) return;
    const isTextTag = TEXT_TAGS.has(el.tagName);
    const looksLeafy = isLeafTextElement(el);
    if (looksLeafy && (isTextTag || el.tagName === "DIV" || el.tagName === "SPAN")) {
      const text = (el.textContent ?? "").trim();
      if (text.length > 0) {
        slots.push({ id: `s${counter++}`, tag: el.tagName.toLowerCase(), current: text, max_chars: Math.max(80, Math.ceil(text.length * 1.5)) });
        return;
      }
    }
    for (const child of Array.from(el.children)) walk(child);
  }
  walk(root);
  return slots;
}

// ── replicas from anthropicClient.ts ─────────────────────────────────
const SLOTS_PER_CHUNK = 25;
const PRICE_PER_M_INPUT = 5.0;
const PRICE_PER_M_OUTPUT = 25.0;
const PRICE_PER_M_CACHE_WRITE = 6.25;
const PRICE_PER_M_CACHE_READ = 0.5;

function estimateCost(slots) {
  const chunks = Math.max(1, Math.ceil(slots.length / SLOTS_PER_CHUNK));
  const systemTokensApprox = 900;
  let totalInput = 0;
  let totalOutput = 0;
  for (let i = 0; i < chunks; i += 1) {
    const chunk = slots.slice(i * SLOTS_PER_CHUNK, (i + 1) * SLOTS_PER_CHUNK);
    const slotPayloadChars = chunk.reduce((acc, s) => acc + 60 + s.current.length + 80, 0);
    const briefTokens = 80;
    const chunkInput = systemTokensApprox + Math.ceil(slotPayloadChars / 4) + briefTokens;
    const chunkOutputBudget = Math.min(7000, 1024 + chunk.reduce((acc, s) => acc + Math.ceil(s.max_chars / 3), 0));
    totalInput += chunkInput;
    totalOutput += Math.round(chunkOutputBudget * 0.6);
  }
  const cacheWriteUsd = (systemTokensApprox / 1_000_000) * PRICE_PER_M_CACHE_WRITE;
  const cacheReadUsd = ((chunks - 1) * systemTokensApprox / 1_000_000) * PRICE_PER_M_CACHE_READ;
  const nonCachedInputTokens = totalInput - chunks * systemTokensApprox;
  const inputUsd = (nonCachedInputTokens / 1_000_000) * PRICE_PER_M_INPUT;
  const outputUsd = (totalOutput / 1_000_000) * PRICE_PER_M_OUTPUT;
  return { chunks, approxInputTokens: totalInput, approxOutputTokens: totalOutput, approxUsd: inputUsd + outputUsd + cacheWriteUsd + cacheReadUsd };
}

function pickPreviewSlots(slots, n = 6) {
  if (slots.length <= n) return slots;
  const h1 = slots.filter((s) => s.tag === "h1");
  const h2 = slots.filter((s) => s.tag === "h2");
  const longP = slots.filter((s) => s.tag === "p" && s.current.length > 120);
  const buttons = slots.filter((s) => s.tag === "button");
  const summaries = slots.filter((s) => s.tag === "summary");
  const longLis = slots.filter((s) => s.tag === "li" && s.current.length > 60);
  const h3 = slots.filter((s) => s.tag === "h3");
  const picked = [];
  const add = (candidates, take) => {
    for (const c of candidates) {
      if (picked.length >= n) return;
      if (take <= 0) return;
      if (!picked.includes(c)) { picked.push(c); take -= 1; }
    }
  };
  add(h1, 1);
  add(h2, 2);
  add(longP, 1);
  add(buttons, 1);
  add(summaries, 1);
  add(longLis, 1);
  add(h3, 1);
  if (picked.length < n) add(slots, n - picked.length);
  return picked.slice(0, n).sort((a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1)));
}

function tokenize(s) {
  return new Set(s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length >= 4));
}
function looksLikeEcho(before, after) {
  const a = tokenize(before);
  const b = tokenize(after);
  if (a.size < 3 || b.size < 3) return false;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter += 1;
  const union = a.size + b.size - inter;
  const jaccard = union > 0 ? inter / union : 0;
  const overlap = inter / Math.min(a.size, b.size);
  return jaccard >= 0.5 || overlap >= 0.5;
}

// ── Tests ────────────────────────────────────────────────────────────
let pass = 0;
let fail = 0;
function check(name, ok, detail) {
  if (ok) { pass += 1; console.log(`✓ ${name}`); }
  else { fail += 1; console.log(`✗ ${name}${detail ? " — " + detail : ""}`); }
}

// ── Cost estimates per preset ────────────────────────────────────────
const PRESETS = [
  "advertorial-longevity.html",
  "crisis-pfas.html",
  "ranking-top5.html",
  "ten-reasons-pan.html",
  "ten-reasons-board.html",
];
console.log("─── Cost estimates ───");
for (const file of PRESETS) {
  const html = readFileSync(new URL(`../src/components/landing/presets/html/${file}`, import.meta.url), "utf8");
  const stage = document.createElement("div");
  stage.innerHTML = html;
  const slots = extractSlots(stage);
  const cost = estimateCost(slots);
  console.log(`  ${file.padEnd(28)} slots=${String(slots.length).padStart(3)} chunks=${String(cost.chunks).padStart(2)} ~$${cost.approxUsd.toFixed(2)}`);
  check(`${file}: cost is positive`, cost.approxUsd > 0);
  check(`${file}: chunks ≤ ceil(slots/25)`, cost.chunks === Math.ceil(slots.length / 25));
  check(`${file}: cost roughly proportional to slot count`, cost.approxUsd < slots.length * 0.02);
}

// ── Preview-slot selection ───────────────────────────────────────────
console.log("\n─── Preview slots (advertorial-longevity) ───");
{
  const html = readFileSync(new URL(`../src/components/landing/presets/html/advertorial-longevity.html`, import.meta.url), "utf8");
  const stage = document.createElement("div");
  stage.innerHTML = html;
  const slots = extractSlots(stage);
  const preview = pickPreviewSlots(slots, 6);
  for (const s of preview) console.log(`  <${s.tag}> "${s.current.slice(0, 70)}${s.current.length > 70 ? "…" : ""}"`);
  check("preview returns exactly n slots when n < total", preview.length === 6, `got ${preview.length}`);
  check("preview contains an h1", preview.some((s) => s.tag === "h1"));
  check("preview contains an h2", preview.some((s) => s.tag === "h2"));
  check("preview is stratified — at least 3 distinct tags", new Set(preview.map((s) => s.tag)).size >= 3, `got tags ${[...new Set(preview.map((s) => s.tag))].join(",")}`);
  check("preview slots are in source order", preview.every((s, i, arr) => i === 0 || Number(s.id.slice(1)) > Number(arr[i - 1].id.slice(1))));
}

// Verify preview picker on every preset — none should crash or return < n.
console.log("\n─── Preview slots (all presets) ───");
for (const file of PRESETS) {
  const html = readFileSync(new URL(`../src/components/landing/presets/html/${file}`, import.meta.url), "utf8");
  const stage = document.createElement("div");
  stage.innerHTML = html;
  const slots = extractSlots(stage);
  const preview = pickPreviewSlots(slots, 6);
  const tags = [...new Set(preview.map((s) => s.tag))];
  console.log(`  ${file.padEnd(28)} picked=${preview.length} tags=[${tags.join(",")}]`);
  check(`${file}: preview returns ${Math.min(6, slots.length)} slots`, preview.length === Math.min(6, slots.length));
  check(`${file}: preview spans at least 2 distinct tags`, tags.length >= 2);
}

// ── Echo detector ────────────────────────────────────────────────────
console.log("\n─── Echo detector ───");
check("identical strings are echoes", looksLikeEcho("Japanese people live longer because of their diet", "Japanese people live longer because of their diet"));
check("trivial swap is still an echo", looksLikeEcho("Nearly 80% of American households use non-stick cookware", "Almost 80% of American households use non-stick cookware"));
check("totally different topic is NOT an echo", !looksLikeEcho("Japanese people live longer because of their diet", "Sleep quality drops sharply after age 35 for most adults"));
check("rewrite for a new product is NOT an echo", !looksLikeEcho("Switch to our titanium pan and ditch toxic non-stick coatings forever", "Reclaim deep sleep with ChronoRest — no melatonin, no morning fog"));
check("short slot (≤2 content words) is exempt", !looksLikeEcho("ORDER NOW", "ORDER NOW"));
check("partial paraphrase that keeps key nouns IS an echo", looksLikeEcho("My grandmother died at 67 from cancer she didn't know was coming", "My grandmother died at 67 because of hidden cancer she never saw coming"));

// ── Done ────────────────────────────────────────────────────────────
console.log(`\n${pass} passed · ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
