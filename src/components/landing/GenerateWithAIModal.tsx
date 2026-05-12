// "Generate with AI" modal — entry point for AI-driven landing creation.
//
// Flow:
//   1. User picks a preset (built-in or user-saved) + fills the brief.
//   2. We load the preset's HTML, parse it into a detached DOM tree,
//      run extractSlots over the body, send slots + brief to Claude.
//   3. Apply the rewrites back to the same detached DOM, serialize,
//      create the new landing, navigate to the editor.
//
// All in-memory — no <iframe>, no double round trip.
//
// Safeguards against burning credit on no-op generations:
//   - The selected preset's slot count drives a cost preview shown
//     above the buttons.  Big presets (advertorial-longevity has 325
//     slots ≈ $1.50–2.50) surface in red so the user opts in knowingly.
//   - A "Test (preview)" button runs Claude on 6 high-impact slots
//     (h1 / h2 / first CTA / first long body) for ~$0.05, renders a
//     before/after table, and lets the user commit to the full run only
//     after the rewrites look right.
//   - Inside `generateLandingCopy` we abort after chunk 1 if Claude
//     echoed ≥50% of slots — that's an `EchoAbortError` here.
//   - We refuse to save a landing whose final echo rate ≥60% (the run
//     completed but the page would still be about the original topic).

import { useEffect, useMemo, useState } from "react";
import { Sparkles, Loader2, AlertTriangle, FlaskConical } from "lucide-react";
import {
  Modal,
  Button,
  HudInput,
  HudTextarea,
  Select,
} from "@/components/hud";
import { PRESETS } from "@/components/landing/presets";
import { useUserPresets, type UserPreset } from "@/stores/userPresetsStore";
import { useSettings } from "@/stores/settingsStore";
import { useLandings } from "@/stores/landingsStore";
import {
  generateLandingCopy,
  estimateCost,
  estimateUsageCost,
  pickPreviewSlots,
  AnthropicNotConfigured,
  EchoAbortError,
  type GenerateBrief,
  type CostEstimate,
} from "@/lib/anthropicClient";
import {
  extractSlots,
  applyRewrites,
  type ExtractedSlot,
} from "@/lib/landingExtract";
import { transformInlineMediaToContainer } from "@/components/landing/landingEditing";
import { serializeCanvas } from "@/components/landing/landingSerialize";
import type { LandingDocument, CssFamily } from "@/lib/landingTypes";
import { toast } from "@/stores/toastStore";
import { cn } from "@/lib/cn";

const TONE_OPTIONS = [
  { value: "", label: "(no preference)" },
  { value: "urgent", label: "Urgent / scarcity-driven" },
  { value: "authoritative", label: "Authoritative / expert" },
  { value: "friendly", label: "Friendly / conversational" },
  { value: "hype", label: "Hype / high-energy" },
  { value: "clinical", label: "Clinical / evidence-led" },
  { value: "narrative", label: "Narrative / storytelling" },
];

/** Saved landings whose serialized HTML scores above this against the
 *  source are refused at save time — Claude clearly didn't reframe. */
const ECHO_REFUSE_THRESHOLD = 0.6;
/** Above this, surface a warning but still save (let the user judge). */
const ECHO_WARN_THRESHOLD = 0.4;

interface PickerPreset {
  id: string;
  name: string;
  description: string;
  css_family: CssFamily;
  loadHtml: () => Promise<string>;
  is_user: boolean;
}

function builtInsAsPickerPresets(): PickerPreset[] {
  return PRESETS.filter((p) => p.id !== "blank").map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    css_family: p.css_family,
    loadHtml: () => p.loadHtml(),
    is_user: false,
  }));
}

function userPresetsAsPickerPresets(items: UserPreset[]): PickerPreset[] {
  return items.map((u) => ({
    id: `user:${u.id}`,
    name: u.name,
    description: u.description ?? "",
    css_family: u.css_family,
    loadHtml: () => Promise.resolve(u.html),
    is_user: true,
  }));
}

interface GenerateWithAIModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (landingId: string) => void;
}

interface PresetPlan {
  presetId: string;
  /** Live nodeRefs into a detached DOM — kept alive across renders so
   *  preview + full run share the same staged document. */
  stage: HTMLElement;
  slots: ExtractedSlot[];
  nodeRefs: Map<string, HTMLElement>;
  cost: CostEstimate;
}

interface PreviewRow {
  id: string;
  tag: string;
  before: string;
  after: string;
  echoed: boolean;
}

interface PreviewResult {
  rows: PreviewRow[];
  echoRate: number;
  usedUsd: number;
}

export function GenerateWithAIModal({
  open,
  onClose,
  onCreated,
}: GenerateWithAIModalProps) {
  const anthropicApiKey = useSettings((s) => s.anthropicApiKey);
  const userPresets = useUserPresets((s) => s.items);
  const userLoaded = useUserPresets((s) => s.loaded);
  const loadUserPresets = useUserPresets((s) => s.load);
  const create = useLandings((s) => s.create);

  const [presetId, setPresetId] = useState("");
  const [productName, setProductName] = useState("");
  const [valueProp, setValueProp] = useState("");
  const [audience, setAudience] = useState("");
  const [tone, setTone] = useState("");
  const [notes, setNotes] = useState("");

  // Plan = the staged DOM + slot list for the currently-selected preset.
  // Lives in a ref-like state slot so preview and full-run share it.
  const [plan, setPlan] = useState<PresetPlan | null>(null);
  const [planLoading, setPlanLoading] = useState(false);

  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const busy = generating || previewing;

  // ── load user presets when the modal opens ───────────────────────────
  useEffect(() => {
    if (open && !userLoaded) void loadUserPresets();
  }, [open, userLoaded, loadUserPresets]);

  // ── reset on close ──────────────────────────────────────────────────
  useEffect(() => {
    if (!open) {
      setErrorMsg(null);
      setPreview(null);
      setPlan(null);
    }
  }, [open]);

  const allPresets: PickerPreset[] = useMemo(
    () => [
      ...userPresetsAsPickerPresets(userPresets),
      ...builtInsAsPickerPresets(),
    ],
    [userPresets],
  );

  const presetOptions = useMemo(
    () =>
      allPresets.map((p) => ({
        value: p.id,
        label: p.is_user ? `★ ${p.name} (custom)` : p.name,
      })),
    [allPresets],
  );

  // Default to first preset on open.
  useEffect(() => {
    if (open && !presetId && allPresets.length > 0) {
      setPresetId(allPresets[0].id);
    }
  }, [open, presetId, allPresets]);

  // ── (Re)build the plan whenever the preset changes ───────────────────
  //
  // We load the preset HTML, stage it in a detached div, extract slots,
  // and compute cost — all so the user sees an accurate "Generate (~$X)"
  // estimate before they spend anything.  Lazy: only fires once a preset
  // is picked, and only when the modal is open.
  useEffect(() => {
    if (!open || !presetId) return;
    let cancelled = false;
    void (async () => {
      setPlanLoading(true);
      // Clear stale preview when preset changes.
      setPreview(null);
      try {
        const preset = allPresets.find((p) => p.id === presetId);
        if (!preset) return;
        const html = await preset.loadHtml();
        if (cancelled) return;
        const stage = document.createElement("div");
        stage.innerHTML = html;
        transformInlineMediaToContainer(stage);
        const { slots, nodeRefs } = extractSlots(stage);
        const cost = estimateCost(slots);
        if (cancelled) return;
        setPlan({ presetId, stage, slots, nodeRefs, cost });
      } catch (e) {
        if (!cancelled) {
          console.error("[generate] failed to build plan:", e);
          setErrorMsg(`Couldn't load that preset: ${e instanceof Error ? e.message : String(e)}`);
        }
      } finally {
        if (!cancelled) setPlanLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, presetId, allPresets]);

  const canSubmit =
    !!presetId &&
    !!plan &&
    plan.presetId === presetId &&
    productName.trim().length > 0 &&
    valueProp.trim().length > 0 &&
    !busy;

  const briefValid = productName.trim().length > 0 && valueProp.trim().length > 0;

  function makeBrief(): GenerateBrief {
    return {
      product_name: productName.trim(),
      value_prop: valueProp.trim(),
      audience: audience.trim() || undefined,
      tone: tone || undefined,
      notes: notes.trim() || undefined,
    };
  }

  /** Pretty-format the EchoAbortError + other API errors. */
  function describeError(e: unknown): string {
    if (e instanceof AnthropicNotConfigured) {
      return "Anthropic API key not set.  Go to Settings → Anthropic and paste your key.";
    }
    if (e instanceof EchoAbortError) {
      return e.message;
    }
    const msg = e instanceof Error ? e.message : String(e);
    if (/429|rate.?limit/i.test(msg)) {
      return "Rate limited (429).  You're on Anthropic's Tier 1 (~8K output tokens/min).  Wait 60s and retry, pick a smaller preset, or upgrade tier.";
    }
    if (/401|invalid.?api.?key|authentication/i.test(msg)) {
      return "Authentication failed (401).  Paste a fresh key at console.anthropic.com → Settings → Anthropic.";
    }
    if (/credit balance/i.test(msg)) {
      return "Out of credits.  Add credit at console.anthropic.com → Plans & Billing.";
    }
    return msg;
  }

  // ── PREVIEW: run on a handful of high-impact slots only ──────────────
  //
  // Picks ~6 strategically-chosen slots (h1, h2, first CTA, first long
  // paragraph) and runs Claude on them with the user's current brief.
  // Renders a before/after table inline.  Doesn't touch the staged DOM
  // (we re-extract from a fresh subset so it can't pollute the full run).
  // Cost: ~$0.02–0.05.
  async function handlePreview() {
    if (!plan || !briefValid) return;
    if (!anthropicApiKey.trim()) {
      setErrorMsg("Set your Anthropic API key in Settings first.");
      return;
    }
    setErrorMsg(null);
    setPreviewing(true);
    setPreview(null);
    try {
      const previewSlots = pickPreviewSlots(plan.slots, 6);
      const { rewrites, usage, echoRate } = await generateLandingCopy({
        apiKey: anthropicApiKey,
        brief: makeBrief(),
        slots: previewSlots,
      });
      const bySlotId = new Map(previewSlots.map((s) => [s.id, s]));
      const rows: PreviewRow[] = rewrites.map((r) => {
        const slot = bySlotId.get(r.id);
        return {
          id: r.id,
          tag: slot?.tag ?? "?",
          before: slot?.current ?? "(unknown)",
          after: r.new_text,
          echoed: !!slot && jaccardEcho(slot.current, r.new_text),
        };
      });
      setPreview({
        rows,
        echoRate,
        usedUsd: estimateUsageCost(usage),
      });
    } catch (e) {
      setErrorMsg(describeError(e));
      console.error("[preview] failed:", e);
    } finally {
      setPreviewing(false);
    }
  }

  // ── FULL GENERATE: run the whole preset, save the landing ────────────
  async function handleGenerate() {
    if (!canSubmit || !plan) return;
    setErrorMsg(null);

    if (!anthropicApiKey.trim()) {
      setErrorMsg("Set your Anthropic API key in Settings first.");
      return;
    }

    const preset = allPresets.find((p) => p.id === presetId);
    if (!preset) {
      setErrorMsg("Pick a preset to start from.");
      return;
    }

    setGenerating(true);
    try {
      setProgress({ done: 0, total: plan.cost.chunks });
      const { rewrites, usage, echoRate } = await generateLandingCopy({
        apiKey: anthropicApiKey,
        brief: makeBrief(),
        slots: plan.slots,
        onProgress: (done, total) => setProgress({ done, total }),
      });

      // 1. Hard guard: if Claude echoed too much, refuse to save.  The
      //    user already paid for the call; saving a no-op page would
      //    just waste their time too.  Surface the echo rate so they
      //    know what to fix.
      if (echoRate >= ECHO_REFUSE_THRESHOLD) {
        throw new Error(
          `Refused to save: Claude echoed ${(echoRate * 100).toFixed(0)}% of slots.  The page would still be about the original topic.  Tighten the brief (more specific product, audience, claims) or try a different preset.  Used ~$${estimateUsageCost(usage).toFixed(2)}.`,
        );
      }

      // 2. Inject rewrites into the staged DOM.
      const { applied, missing } = applyRewrites(plan.nodeRefs, rewrites);
      if (applied === 0) {
        throw new Error(
          "Claude returned a response but none of the rewrites matched the slots.  Open devtools for the response table.",
        );
      }
      if (missing.length > 0) {
        console.warn(`[generate] ${missing.length} slots not rewritten:`, missing);
      }

      // 3. Serialize.
      const html = serializeCanvas(plan.stage);
      const doc: LandingDocument = {
        html,
        meta: {
          preset_id: preset.id,
          css_family: preset.css_family,
        },
      };
      const created = await create({
        name: `${productName.trim()} — generated`,
        preset_id: preset.id,
        doc,
      });

      const usedUsd = estimateUsageCost(usage);
      const cacheHit = (usage.cache_read_input_tokens ?? 0) > 0;
      const cost = `$${usedUsd.toFixed(2)}`;
      if (echoRate >= ECHO_WARN_THRESHOLD) {
        toast.warning(
          "Generated — but echo-y",
          `${applied}/${plan.slots.length} slots rewritten · echo ${Math.round(echoRate * 100)}% · ${cost}.  Review carefully before shipping.`,
        );
      } else {
        toast.success(
          "Generated",
          `${applied}/${plan.slots.length} slots rewritten · ${cost}${cacheHit ? " · cache hit" : ""}`,
        );
      }
      onCreated(created.id);
      onClose();
    } catch (e) {
      setErrorMsg(describeError(e));
      console.error("[generate] failed:", e);
    } finally {
      setGenerating(false);
      setProgress(null);
    }
  }

  const keyMissing = !anthropicApiKey.trim();

  const costColor =
    plan && plan.cost.approxUsd > 1
      ? "text-hud-red"
      : plan && plan.cost.approxUsd > 0.3
        ? "text-hud-amber"
        : "text-fg";

  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : onClose}
      size="lg"
      title="Generate with AI"
      subtitle="// New Landing Page"
      closeOnOverlayClick={!busy}
      closeOnEscape={!busy}
    >
      <div className="p-6 space-y-5">
        <p className="font-mono text-xs text-fg-muted">
          Claude rewrites every text slot of a chosen preset to fit your
          brief.  Test with the preview button first (cheap) before
          committing to a full run.
        </p>

        {keyMissing && (
          <div className="border border-hud-amber/50 bg-hud-amber/[0.05] p-3 rounded">
            <div className="flex items-start gap-2 text-hud-amber">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5" />
              <div className="font-mono text-[0.7rem]">
                Anthropic API key not configured.  Open <strong>Settings</strong>{" "}
                → <strong>Anthropic</strong> and paste a key starting with{" "}
                <code className="text-fg-muted">sk-ant-</code>.
              </div>
            </div>
          </div>
        )}

        <div>
          <div className="hud-label text-fg-dim mb-2">Preset to start from</div>
          <Select
            options={presetOptions}
            value={presetId}
            onChange={setPresetId}
            placeholder="Pick a preset"
          />
          {planLoading && (
            <div className="hud-label text-fg-dim mt-2">Loading preset…</div>
          )}
          {plan && !planLoading && (
            <div className="hud-label text-fg-dim mt-2">
              {plan.slots.length} text slots · ~{plan.cost.chunks} chunk
              {plan.cost.chunks === 1 ? "" : "s"} · est.{" "}
              <span className={costColor}>${plan.cost.approxUsd.toFixed(2)}</span>{" "}
              for the full run
              {plan.cost.approxUsd > 1 && (
                <span className="text-hud-red"> · use Test first</span>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <HudInput
            label="Product / brand name"
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            placeholder="e.g. TitanGrip Pans"
            maxLength={80}
          />
          <HudInput
            label="One-line value prop"
            value={valueProp}
            onChange={(e) => setValueProp(e.target.value)}
            placeholder="e.g. The only PFAS-free titanium pan"
            maxLength={160}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <HudInput
            label="Audience (optional)"
            value={audience}
            onChange={(e) => setAudience(e.target.value)}
            placeholder="e.g. health-conscious home cooks 35+"
            maxLength={160}
          />
          <div>
            <div className="hud-label text-fg-dim mb-2">Tone (optional)</div>
            <Select options={TONE_OPTIONS} value={tone} onChange={setTone} />
          </div>
        </div>

        <div>
          <div className="hud-label text-fg-dim mb-2">
            Notes / specific claims to use (optional)
          </div>
          <HudTextarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. PFAS-free, lifetime warranty, 30-day money back guarantee, made in USA, 5-ply titanium core"
            rows={3}
            maxLength={1000}
          />
        </div>

        {/* ── Preview results panel ───────────────────────────────────── */}
        {preview && (
          <div className="border border-border-hud bg-bg-base/40 rounded p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="hud-label text-hud-cyan">
                Preview · {preview.rows.length} slots · echo{" "}
                {(preview.echoRate * 100).toFixed(0)}% · spent ~$
                {preview.usedUsd.toFixed(3)}
              </div>
              <button
                type="button"
                onClick={() => setPreview(null)}
                className="hud-label text-fg-dim hover:text-fg"
              >
                clear
              </button>
            </div>
            {preview.echoRate >= ECHO_REFUSE_THRESHOLD && (
              <div className="text-[0.7rem] text-hud-red font-mono">
                Claude echoed too much — full Generate would be refused.  Tighten the brief first.
              </div>
            )}
            <div className="space-y-2 max-h-72 overflow-auto">
              {preview.rows.map((row) => (
                <div
                  key={row.id}
                  className={cn(
                    "border-l-2 pl-2 py-1",
                    row.echoed ? "border-hud-red" : "border-hud-cyan",
                  )}
                >
                  <div className="hud-label text-fg-dim">
                    &lt;{row.tag}&gt; {row.echoed && <span className="text-hud-red">· echoed</span>}
                  </div>
                  <div className="font-mono text-[0.7rem] text-fg-muted truncate">
                    {row.before}
                  </div>
                  <div className="font-mono text-[0.75rem] text-fg truncate">
                    → {row.after}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {errorMsg && (
          <div className="border border-hud-red/50 bg-hud-red/[0.05] p-3 rounded">
            <div className="flex items-start gap-2 text-hud-red">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5" />
              <div className="font-mono text-[0.7rem] break-words">
                {errorMsg}
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-2 pt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </Button>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              iconLeft={
                previewing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <FlaskConical className="w-3.5 h-3.5" />
                )
              }
              onClick={handlePreview}
              disabled={busy || !plan || !briefValid || keyMissing}
              title={
                !briefValid
                  ? "Fill the product name + value prop first"
                  : "Test the brief on 6 high-impact slots (~$0.05)"
              }
            >
              {previewing ? "Testing…" : "Test (~$0.05)"}
            </Button>
            <Button
              variant="primary"
              size="sm"
              iconLeft={
                generating ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )
              }
              onClick={handleGenerate}
              disabled={!canSubmit || keyMissing}
              title={
                !canSubmit
                  ? "Pick a preset, name the product, add a value prop"
                  : plan
                    ? `Generate the full landing (~$${plan.cost.approxUsd.toFixed(2)})`
                    : undefined
              }
            >
              {generating
                ? progress && progress.total > 1
                  ? `Generating ${progress.done + 1}/${progress.total}…`
                  : "Generating…"
                : plan
                  ? `Generate (~$${plan.cost.approxUsd.toFixed(2)})`
                  : "Generate"}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// Same combined Jaccard + overlap-coefficient echo rule as
// `anthropicClient.looksLikeEcho`, re-implemented here so the
// preview-row "echoed" flag stays decoupled from the client.  Tuned
// against scripts/test-safeguards.mjs — keep in sync.
function jaccardEcho(before: string, after: string): boolean {
  const tokenize = (s: string) =>
    new Set(
      s
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length >= 4),
    );
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
