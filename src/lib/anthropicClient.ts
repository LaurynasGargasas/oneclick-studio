// Anthropic API wrapper used by the "Generate with AI" landings flow.
//
// Architecture:
// - Browser-direct (dangerouslyAllowBrowser).  The key lives in local
//   SQLite via settingsStore; we never proxy it through a server.
// - Structured output via `messages.parse()` + Zod, so we get an
//   already-typed `{id, new_text}[]` back without manual JSON parsing.
// - Prompt caching: the slot-list block (stable per preset) carries
//   `cache_control`, so re-generating against the same preset (with a
//   different brief) reads the cached prefix at ~0.1× cost.
// - Model: claude-opus-4-7 by default (best instruction following for
//   tone + length nuance; user can switch to Sonnet via settings if cost
//   matters).  Thinking is off by default on 4.7 — we don't enable it,
//   keeping latency to ~10–25s for a typical landing.

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { ExtractedSlot } from "@/lib/landingExtract";

export interface GenerateBrief {
  product_name: string;
  value_prop: string;
  audience?: string;
  tone?: string;
  notes?: string;
}

export const RewriteSchema = z.object({
  rewrites: z.array(
    z.object({
      id: z.string(),
      new_text: z.string(),
    }),
  ),
});

export type RewriteResponse = z.infer<typeof RewriteSchema>;

const SYSTEM_PROMPT = `You are a senior direct-response landing-page copywriter.  Your job is to CONVERT an existing high-converting landing page so it sells a DIFFERENT product described in the BRIEF.  The page's structure, layout, and rhythm stay — every word of body copy is fully rewritten for the new product.

CRITICAL — read this twice:
- The original page's TOPIC, NARRATIVE, CHARACTERS, CLAIMS, and PRODUCT CATEGORY are scaffolding.  Throw them out.  The output text must read as if the page were written from scratch about the BRIEF's product, for the BRIEF's audience, in the BRIEF's tone.  Do NOT keep the original topic, hero, villain, problem framing, or product category.  Reframe everything.
- If the original tells a story about, say, non-stick cookware causing harm, and the BRIEF is about a sleep supplement, the rewritten story must be about poor sleep / a sleep villain / the supplement as hero — NOT a tweaked version of the cookware story.
- The ONLY things to keep from \`current\` are: structural cues (numbering like "Reason #3", question/answer pairing, CTA being verb-first, comparison-table markers like ✓/✗) and approximate LENGTH.  Everything else is yours to invent for the new product.
- Write in the same language as the BRIEF.  If the BRIEF is English, the output is English — even if the source has foreign words.

YOU WILL BE GIVEN:
1. A BRIEF describing the new product, audience, tone, and any specific claims to use.
2. A JSON list of SLOTS extracted from the page, each with:
   - id: opaque identifier (return verbatim)
   - tag: HTML tag (h1, p, li, button, summary, etc.)
   - path: short CSS path — use this to infer role (hero, faq, cta, testimonial, table cell)
   - current: the existing text — treat as a LENGTH + STRUCTURAL hint only, never as content to preserve
   - max_chars: approximate length budget

HARD RULES:
- Stay within roughly ±25% of \`max_chars\` per slot.  Don't blow past it.
- Match the tone specified in the BRIEF (urgent / authoritative / friendly / hype / clinical / narrative).
- For numbered "Reason #N" patterns: preserve the numbering exactly (the topic of each reason is yours to invent for the new product).
- For FAQ answers (path contains "faq" / "qa" / "accordion"): write the question (if it's a question slot) or answer (if it's an answer slot) about the NEW product.  Q/A pairs may be split across chunks — make each slot stand on its own.
- For CTAs (tag=button or path contains "cta" / "atc"): punchy verb-first command tied to the new product's offer ("CLAIM MY DISCOUNT", "GET MY BOTTLE", "ORDER NOW").
- For testimonials (path contains "testimonial" / "review" / "rfw"): invent plausible US first name + last initial + city/state, and a 5-star quote SPECIFIC to the new product's benefit.  Don't re-skin the original testimonial.
- For "verified buyer" / generic role labels: keep them generic.
- For comparison-table cell content that's a single short marker (yes/no/✓/✗/single word): copy verbatim.  Multi-word cells are rewritten about the new product.
- For numeric placeholders that are clearly mechanical (timers like "00:00:00", "$XX.XX", star counts, asterisks): copy unchanged.
- Do NOT fabricate medical, financial, regulatory, or legal claims unless the BRIEF explicitly grants them.
- Do NOT introduce URLs, emails, phone numbers, or specific prices that aren't in the BRIEF.
- For brand-name slots: use the new product name from the BRIEF.

ANTI-ECHO CHECK:
Before you finalize, scan your rewrites.  If more than a quarter of them are near-paraphrases of the original (same nouns, same scenario, same imagery), you have FAILED the task — start over and reframe more aggressively for the BRIEF's product.

Return ONLY the JSON in the format the schema requires: an object with a \`rewrites\` array containing one \`{id, new_text}\` per slot you received.  Every slot must appear in your response.`;

export class AnthropicNotConfigured extends Error {
  constructor() {
    super("Anthropic API key not configured.  Set it in Settings.");
    this.name = "AnthropicNotConfigured";
  }
}

/**
 * Thrown by `generateLandingCopy` when the first chunk's echo rate is
 * high enough that finishing the remaining chunks would be wasted spend.
 * The modal converts this to an actionable user message + skips the
 * landing create.
 */
export class EchoAbortError extends Error {
  public readonly echoRate: number;
  public readonly usedUsd: number;
  constructor(echoRate: number, usedUsd: number) {
    super(
      `Claude echoed ${(echoRate * 100).toFixed(0)}% of the first chunk — aborted before more credit was spent (used ~$${usedUsd.toFixed(2)}).  Tighten the brief (more specific product, audience, claims) or try a different preset.`,
    );
    this.name = "EchoAbortError";
    this.echoRate = echoRate;
    this.usedUsd = usedUsd;
  }
}

// ── Opus 4.7 pricing (per 1M tokens) ─────────────────────────────────
// Source: shared/models.md cached snapshot 2026-04-29.  Used by
// `estimateCost` to show users the spend before they hit Generate.
const PRICE_PER_M_INPUT = 5.0;
const PRICE_PER_M_OUTPUT = 25.0;
const PRICE_PER_M_CACHE_WRITE = 6.25;      // 1.25× input
const PRICE_PER_M_CACHE_READ = 0.5;        // 0.1× input

export interface CostEstimate {
  chunks: number;
  approxInputTokens: number;
  approxOutputTokens: number;
  approxUsd: number;
}

/**
 * Rough cost estimate for `generateLandingCopy(slots)` on Opus 4.7.
 * Assumes the system prompt is cached (true for chunk 2+) and the
 * payload is dominated by the slot JSON.  Output budget is the same
 * heuristic `callClaudeOnce` uses (1024 + sum(ceil(max_chars/3))),
 * capped at 7K per chunk.
 */
export function estimateCost(slots: ExtractedSlot[]): CostEstimate {
  const chunks = Math.max(1, Math.ceil(slots.length / SLOTS_PER_CHUNK));
  const systemTokensApprox = 900;            // ~3500 chars of system prompt
  let totalInput = 0;
  let totalOutput = 0;
  for (let i = 0; i < chunks; i += 1) {
    const chunk = slots.slice(i * SLOTS_PER_CHUNK, (i + 1) * SLOTS_PER_CHUNK);
    const slotPayloadChars = chunk.reduce(
      (acc, s) => acc + 60 + s.current.length + 80,   // tag/path/current/max_chars JSON overhead
      0,
    );
    const briefTokens = 80;
    const chunkInput = systemTokensApprox + Math.ceil(slotPayloadChars / 4) + briefTokens;
    const chunkOutputBudget = Math.min(
      7000,
      1024 + chunk.reduce((acc, s) => acc + Math.ceil(s.max_chars / 3), 0),
    );
    totalInput += chunkInput;
    // Assume actual output ≈ 60% of budget (Claude doesn't always max).
    totalOutput += Math.round(chunkOutputBudget * 0.6);
  }
  // Cache: first chunk pays write price for the system prompt; later chunks read.
  const cacheWriteUsd = (systemTokensApprox / 1_000_000) * PRICE_PER_M_CACHE_WRITE;
  const cacheReadUsd =
    ((chunks - 1) * systemTokensApprox / 1_000_000) * PRICE_PER_M_CACHE_READ;
  const nonCachedInputTokens = totalInput - chunks * systemTokensApprox;
  const inputUsd = (nonCachedInputTokens / 1_000_000) * PRICE_PER_M_INPUT;
  const outputUsd = (totalOutput / 1_000_000) * PRICE_PER_M_OUTPUT;
  return {
    chunks,
    approxInputTokens: totalInput,
    approxOutputTokens: totalOutput,
    approxUsd: inputUsd + outputUsd + cacheWriteUsd + cacheReadUsd,
  };
}

/**
 * Pick a handful of high-impact AND diverse slots for a cheap preview
 * run.  Stratified by tag: 1 H1, up to 2 H2s, 1 long body paragraph,
 * 1 CTA-style button, 1 summary/list item.  This tells you about voice
 * in headlines, body, AND CTAs in one $0.05 call — much more
 * informative than 6 H2s.  Returns slots in source order for stable
 * diffing in the UI.
 */
export function pickPreviewSlots(
  slots: ExtractedSlot[],
  n = 6,
): ExtractedSlot[] {
  if (slots.length <= n) return slots;
  // Bucket by role so the preview spans tag types.
  const h1 = slots.filter((s) => s.tag === "h1");
  const h2 = slots.filter((s) => s.tag === "h2");
  const longP = slots.filter((s) => s.tag === "p" && s.current.length > 120);
  const buttons = slots.filter((s) => s.tag === "button");
  const summaries = slots.filter((s) => s.tag === "summary");
  const longLis = slots.filter((s) => s.tag === "li" && s.current.length > 60);
  const h3 = slots.filter((s) => s.tag === "h3");

  const picked: ExtractedSlot[] = [];
  const add = (candidates: ExtractedSlot[], take: number) => {
    for (const c of candidates) {
      if (picked.length >= n) return;
      if (take <= 0) return;
      if (!picked.includes(c)) {
        picked.push(c);
        take -= 1;
      }
    }
  };
  add(h1, 1);
  add(h2, 2);
  add(longP, 1);
  add(buttons, 1);
  add(summaries, 1);
  add(longLis, 1);
  add(h3, 1);
  // Fall back: if some buckets were empty, fill from anywhere.
  if (picked.length < n) add(slots, n - picked.length);

  return picked
    .slice(0, n)
    .sort((a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1)));
}

function makeClient(apiKey: string): Anthropic {
  if (!apiKey || !apiKey.trim()) throw new AnthropicNotConfigured();
  return new Anthropic({
    apiKey,
    dangerouslyAllowBrowser: true,
  });
}

interface GenerateOptions {
  apiKey: string;
  model?: string;
  brief: GenerateBrief;
  slots: ExtractedSlot[];
  signal?: AbortSignal;
  /** Called between chunks so the UI can show progress. */
  onProgress?: (chunkIndex: number, totalChunks: number) => void;
}

export interface GenerateResult {
  rewrites: Array<{ id: string; new_text: string }>;
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens: number;
    cache_read_input_tokens: number;
  };
  /** Fraction of slots whose rewrite reads as a near-echo of the source
   *  (Jaccard ≥0.6 on content words ≥4 chars).  ≥0.5 is a strong signal
   *  Claude didn't actually reframe the page. */
  echoRate: number;
}

// Tier 1 output cap is 8K tokens/minute.  Picking 25 slots per chunk
// keeps each request comfortably under that ceiling even for verbose
// rewrites, and chunks the cost so a partial failure doesn't waste a
// huge request.  Tier 2+ accounts could raise this; left conservative
// for safety.
const SLOTS_PER_CHUNK = 25;

/**
 * Rewrite every slot's text via Claude.  Long preset slot lists are
 * chunked into batches of `SLOTS_PER_CHUNK` so each individual request
 * fits under Tier 1's per-minute output cap.  Returns a flat array of
 * `{id, new_text}` ready to feed into `applyRewrites(...)`.
 *
 * Stable across calls (cached): system prompt.
 * Variable per call: the slot chunk + the brief.
 */
export async function generateLandingCopy(
  opts: GenerateOptions,
): Promise<GenerateResult> {
  const { apiKey, brief, slots, signal, onProgress } = opts;
  const model = opts.model ?? "claude-opus-4-7";
  const client = makeClient(apiKey);

  const chunks: ExtractedSlot[][] = [];
  for (let i = 0; i < slots.length; i += SLOTS_PER_CHUNK) {
    chunks.push(slots.slice(i, i + SLOTS_PER_CHUNK));
  }

  const allRewrites: Array<{ id: string; new_text: string }> = [];
  const totalUsage: GenerateResult["usage"] = {
    input_tokens: 0,
    output_tokens: 0,
    cache_creation_input_tokens: 0,
    cache_read_input_tokens: 0,
  };

  for (let i = 0; i < chunks.length; i += 1) {
    onProgress?.(i, chunks.length);
    const chunkResult = await callClaudeOnce({
      client,
      model,
      brief,
      slots: chunks[i],
      signal,
    });
    allRewrites.push(...chunkResult.rewrites);
    totalUsage.input_tokens += chunkResult.usage.input_tokens;
    totalUsage.output_tokens += chunkResult.usage.output_tokens;
    totalUsage.cache_creation_input_tokens +=
      chunkResult.usage.cache_creation_input_tokens ?? 0;
    totalUsage.cache_read_input_tokens +=
      chunkResult.usage.cache_read_input_tokens ?? 0;

    // Early-abort: after the first chunk completes, check how much of
    // it Claude echoed.  If ≥50% of the chunk's non-trivial slots are
    // near-paraphrases of the original, the rest of the run will be
    // wasted credit — throw before launching chunks 2..N.  Only fires
    // when there are at least 2 chunks; one-chunk runs always finish.
    if (i === 0 && chunks.length > 1) {
      const firstChunkEcho = computeEchoRate(chunks[0], chunkResult.rewrites);
      if (firstChunkEcho >= 0.5) {
        const usedUsd = estimateUsageCost(totalUsage);
        // eslint-disable-next-line no-console
        console.warn(
          `[generate] aborting after chunk 1 — echo rate ${(firstChunkEcho * 100).toFixed(0)}% (~$${usedUsd.toFixed(2)} spent)`,
        );
        throw new EchoAbortError(firstChunkEcho, usedUsd);
      }
    }
  }

  onProgress?.(chunks.length, chunks.length);

  // Diagnostic: per-slot table in devtools so the user can see exactly
  // what came back vs. what was sent.  High-signal when the page looks
  // unchanged — they can spot in seconds whether Claude rewrote or echoed.
  const echoRate = computeEchoRate(slots, allRewrites);
  logRewriteTable(slots, allRewrites, echoRate, totalUsage);

  return { rewrites: allRewrites, usage: totalUsage, echoRate };
}

/** Jaccard-overlap echo detector.  See `looksLikeEcho` for the per-pair
 *  rule; this aggregates over a (sub)set of slots and returns the
 *  fraction Claude echoed.  Used by both the early-abort check and the
 *  final result. */
function computeEchoRate(
  slots: ExtractedSlot[],
  rewrites: Array<{ id: string; new_text: string }>,
): number {
  if (rewrites.length === 0) return 0;
  const byId = new Map(slots.map((s) => [s.id, s.current]));
  let echoCount = 0;
  let judged = 0;
  for (const r of rewrites) {
    const before = byId.get(r.id);
    if (before === undefined) continue;     // hallucinated id — not echo, just bad
    if (!isJudgeable(before)) continue;     // single-word / mechanical slots are exempt
    judged += 1;
    if (looksLikeEcho(before, r.new_text)) echoCount += 1;
  }
  return judged > 0 ? echoCount / judged : 0;
}

/** Slots short enough that the system prompt tells Claude to copy them
 *  verbatim (single-word CTAs, ✓/✗, "Yes"/"No", "00:00:00") — we don't
 *  count them as echoes regardless of content. */
function isJudgeable(text: string): boolean {
  return tokenize(text).size >= 3;
}

function tokenize(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 4),
  );
}

/** Per-pair echo detector on content words ≥4 chars.  Flags as echo if
 *  EITHER:
 *    - Jaccard overlap ≥ 0.5 (both sides share half their content), OR
 *    - Overlap coefficient (inter / min(|a|,|b|)) ≥ 0.5 (one side is
 *      mostly contained in the other — catches paraphrases where Claude
 *      kept the same scenario and key nouns but reworded the sentence)
 *
 *  Jaccard alone misses partial paraphrases where Claude reshuffled
 *  words around the same nouns; the overlap coefficient catches those.
 *  Together they're tight enough to flag real echoes but loose enough
 *  that legitimate rewrites sharing 2–3 common words (with, premium,
 *  from) don't get false-flagged.  Tuned against the test cases in
 *  scripts/test-safeguards.mjs. */
function looksLikeEcho(before: string, after: string): boolean {
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

function logRewriteTable(
  slots: ExtractedSlot[],
  rewrites: Array<{ id: string; new_text: string }>,
  echoRate: number,
  usage: GenerateResult["usage"],
): void {
  const byId = new Map(slots.map((s) => [s.id, s]));
  const rows = rewrites.map((r) => {
    const slot = byId.get(r.id);
    return {
      id: r.id,
      tag: slot?.tag ?? "?",
      before: truncate(slot?.current ?? "", 60),
      after: truncate(r.new_text, 60),
      echoed: slot && isJudgeable(slot.current) ? looksLikeEcho(slot.current, r.new_text) : false,
    };
  });
  /* eslint-disable no-console */
  const usedUsd = estimateUsageCost(usage);
  console.groupCollapsed(
    `[generate] ${rewrites.length} rewrites · echo ${(echoRate * 100).toFixed(0)}% · ~$${usedUsd.toFixed(3)} · usage ${JSON.stringify(usage)}`,
  );
  console.table(rows);
  console.groupEnd();
  if (echoRate >= 0.5) {
    console.warn(
      `[generate] Claude echoed ≥50% of slots — the page is probably still about the original topic.`,
    );
  }
  /* eslint-enable no-console */
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + "…";
}

/** Convert a usage object into dollars for surfacing in toasts / logs.
 *  Mirrors the cost model in `estimateCost` (Opus 4.7 pricing). */
export function estimateUsageCost(usage: GenerateResult["usage"]): number {
  const nonCachedInput = usage.input_tokens;   // input_tokens excludes cached reads on Anthropic API
  const cacheWrite = usage.cache_creation_input_tokens;
  const cacheRead = usage.cache_read_input_tokens;
  const output = usage.output_tokens;
  return (
    (nonCachedInput / 1_000_000) * PRICE_PER_M_INPUT +
    (cacheWrite / 1_000_000) * PRICE_PER_M_CACHE_WRITE +
    (cacheRead / 1_000_000) * PRICE_PER_M_CACHE_READ +
    (output / 1_000_000) * PRICE_PER_M_OUTPUT
  );
}

async function callClaudeOnce(args: {
  client: Anthropic;
  model: string;
  brief: GenerateBrief;
  slots: ExtractedSlot[];
  signal?: AbortSignal;
}): Promise<{
  rewrites: Array<{ id: string; new_text: string }>;
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens: number | null;
    cache_read_input_tokens: number | null;
  };
}> {
  const { client, model, brief, slots, signal } = args;
  const slotsJson = JSON.stringify(slots, null, 2);
  const briefText = formatBrief(brief);

  // Budget = base + per-slot output headroom; capped at 7000 to leave
  // slack under the 8K OTPM ceiling.
  const max_tokens = clamp(
    1024 + slots.reduce((acc, s) => acc + Math.ceil(s.max_chars / 3), 0),
    2048,
    7000,
  );

  const response = await client.messages.parse(
    {
      model,
      max_tokens,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          // Cache the system prompt — fully stable across all chunks
          // and all generations.
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `SLOTS (${slots.length} in this chunk):\n${slotsJson}`,
            },
            {
              type: "text",
              text: `BRIEF:\n${briefText}`,
            },
          ],
        },
      ],
      output_config: {
        format: zodOutputFormat(RewriteSchema),
      },
    },
    { signal },
  );

  const parsed = response.parsed_output;
  if (!parsed) {
    throw new Error(
      `Claude returned an unparseable response (stop_reason: ${response.stop_reason}).`,
    );
  }

  return {
    rewrites: parsed.rewrites,
    usage: {
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
      cache_creation_input_tokens:
        response.usage.cache_creation_input_tokens ?? null,
      cache_read_input_tokens: response.usage.cache_read_input_tokens ?? null,
    },
  };
}

function formatBrief(brief: GenerateBrief): string {
  const lines = [
    `Product: ${brief.product_name}`,
    `Value proposition: ${brief.value_prop}`,
  ];
  if (brief.audience) lines.push(`Audience: ${brief.audience}`);
  if (brief.tone) lines.push(`Tone: ${brief.tone}`);
  if (brief.notes) lines.push(`Notes / specific claims to use:\n${brief.notes}`);
  return lines.join("\n");
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
