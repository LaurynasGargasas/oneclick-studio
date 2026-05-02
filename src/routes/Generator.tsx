import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Search,
  Wand2,
  CheckCircle,
  AlertCircle,
  Hash,
} from "lucide-react";
import { Button, Toggle, Select, Slider } from "@/components/hud";
import { useElements } from "@/stores/elementsStore";
import { useProjects } from "@/stores/projectsStore";
import { useGenerations } from "@/stores/generationsStore";
import { useSettings } from "@/stores/settingsStore";
import { ELEMENT_TYPES, ELEMENT_TYPE_META, type ElementType } from "@/lib/elementTypes";
import { cn } from "@/lib/cn";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractTags(prompt: string): string[] {
  const matches = [...prompt.matchAll(/@([\w-]+)/g)];
  return [...new Set(matches.map((m) => m[1].toLowerCase()))];
}

function insertAtCursor(
  textarea: HTMLTextAreaElement,
  text: string,
): { value: string; cursorPos: number } {
  const start = textarea.selectionStart ?? textarea.value.length;
  const end = textarea.selectionEnd ?? textarea.value.length;
  const before = textarea.value.slice(0, start);
  const after = textarea.value.slice(end);
  const needsSpace = before.length > 0 && !/\s$/.test(before);
  const insert = (needsSpace ? " " : "") + text + " ";
  return {
    value: before + insert + after,
    cursorPos: start + insert.length,
  };
}

// ---------------------------------------------------------------------------
// Left panel — Element browser
// ---------------------------------------------------------------------------

interface ElementBrowserProps {
  onInsert: (tag: string) => void;
}

function ElementBrowser({ onInsert }: ElementBrowserProps) {
  const items = useElements((s) => s.items);
  const loaded = useElements((s) => s.loaded);
  const load = useElements((s) => s.load);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<ElementType | "all">("all");

  useEffect(() => {
    if (!loaded) void load();
  }, [loaded, load]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return items.filter((el) => {
      if (typeFilter !== "all" && el.type !== typeFilter) return false;
      if (q) return el.tag.includes(q) || el.display_name.toLowerCase().includes(q);
      return true;
    });
  }, [items, search, typeFilter]);

  const typeOptions = [
    { value: "all", label: "All" },
    ...ELEMENT_TYPES.map((t) => ({
      value: t,
      label: ELEMENT_TYPE_META[t].label,
    })),
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="p-4 border-b border-border-hud shrink-0 space-y-3">
        <div className="hud-label text-fg-dim">// Elements</div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-fg-dim pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tags…"
            className="w-full bg-bg-elevated/60 border border-border-hud pl-8 pr-3 py-1.5 font-mono text-xs text-fg placeholder:text-fg-dim focus:outline-none focus:border-hud-cyan transition-colors"
          />
        </div>
        <Select
          value={typeFilter}
          onChange={(v) => setTypeFilter(v as ElementType | "all")}
          options={typeOptions}
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        {!loaded ? (
          <div className="p-4 hud-label text-fg-muted hud-pulse text-center mt-8">
            Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-4 text-center mt-8">
            <p className="font-mono text-xs text-fg-muted">
              {items.length === 0 ? "No elements yet. Add some in the Elements library." : "No matches."}
            </p>
          </div>
        ) : (
          filtered.map((el) => {
            const meta = ELEMENT_TYPE_META[el.type];
            return (
              <button
                key={el.id}
                type="button"
                onClick={() => onInsert(`@${el.tag}`)}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-bg-elevated/60 transition-colors border-b border-border-hud/40 text-left group"
              >
                <span
                  className="shrink-0 font-mono text-[0.6rem] uppercase px-1.5 py-0.5 border"
                  style={{ color: meta.color, borderColor: meta.color, background: meta.bg }}
                >
                  {el.type.slice(0, 3)}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="font-mono text-xs text-fg truncate block">
                    {el.display_name}
                  </span>
                  <span
                    className="font-mono text-[0.6rem] truncate block"
                    style={{ color: meta.color }}
                  >
                    @{el.tag}
                  </span>
                </span>
                <Hash
                  className="w-3 h-3 text-fg-dim opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                />
              </button>
            );
          })
        )}
      </div>

      <div className="p-3 border-t border-border-hud shrink-0">
        <p className="font-mono text-[0.6rem] text-fg-muted text-center">
          Click an element to insert its @tag
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Right panel — Parameters
// ---------------------------------------------------------------------------

const RESOLUTION_OPTIONS = [
  { value: "360p", label: "360p — Draft" },
  { value: "480p", label: "480p — Preview" },
  { value: "720p", label: "720p — Standard" },
  { value: "1080p", label: "1080p — Full HD" },
];

const ASPECT_OPTIONS = [
  { value: "16:9", label: "16:9 — Landscape" },
  { value: "9:16", label: "9:16 — Portrait" },
  { value: "1:1", label: "1:1 — Square" },
  { value: "4:3", label: "4:3 — Classic" },
  { value: "3:4", label: "3:4 — Tall" },
];

const QUALITY_OPTIONS = [
  { value: "standard", label: "Standard" },
  { value: "pro", label: "Pro" },
];

interface Params {
  projectId: string;
  duration: number;
  resolution: string;
  aspectRatio: string;
  quality: string;
  seed: string;
  cameraFixed: boolean;
  watermark: boolean;
  audioEnabled: boolean;
}

interface ParamsPanelProps {
  params: Params;
  onChange: <K extends keyof Params>(key: K, value: Params[K]) => void;
}

function ParamsPanel({ params, onChange }: ParamsPanelProps) {
  const projects = useProjects((s) => s.items);
  const loaded = useProjects((s) => s.loaded);
  const load = useProjects((s) => s.load);

  useEffect(() => {
    if (!loaded) void load();
  }, [loaded, load]);

  const projectOptions = [
    { value: "", label: "No project" },
    ...projects.map((p) => ({
      value: p.id,
      label: p.name,
      color: p.color_accent,
    })),
  ];

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="p-4 border-b border-border-hud shrink-0">
        <div className="hud-label text-fg-dim">// Parameters</div>
      </div>

      <div className="p-4 space-y-5 flex-1">
        <Select
          label="Project"
          value={params.projectId}
          onChange={(v) => onChange("projectId", v)}
          options={projectOptions}
          placeholder="No project"
        />

        <Slider
          label="Duration"
          unit="s"
          value={params.duration}
          onChange={(v) => onChange("duration", v)}
          min={5}
          max={10}
          step={5}
          ticks={[5, 10]}
        />

        <Select
          label="Resolution"
          value={params.resolution}
          onChange={(v) => onChange("resolution", v)}
          options={RESOLUTION_OPTIONS}
        />

        <Select
          label="Aspect Ratio"
          value={params.aspectRatio}
          onChange={(v) => onChange("aspectRatio", v)}
          options={ASPECT_OPTIONS}
        />

        <Select
          label="Quality"
          value={params.quality}
          onChange={(v) => onChange("quality", v)}
          options={QUALITY_OPTIONS}
        />

        <div>
          <span className="hud-label text-fg-muted block mb-1.5">Seed</span>
          <input
            type="number"
            value={params.seed}
            onChange={(e) => onChange("seed", e.target.value)}
            placeholder="Random"
            className="w-full bg-bg-elevated/60 border border-border-hud px-3 py-2 font-mono text-sm text-fg placeholder:text-fg-dim focus:outline-none focus:border-hud-cyan transition-colors"
          />
          <p className="font-mono text-[0.6rem] text-fg-dim mt-1">
            Leave blank for a random seed
          </p>
        </div>

        <div className="space-y-3 pt-1 border-t border-border-hud">
          <div className="hud-label text-fg-dim pt-2">// Flags</div>
          <Toggle
            label="Audio Enabled"
            checked={params.audioEnabled}
            onChange={(v) => onChange("audioEnabled", v)}
            size="sm"
          />
          <Toggle
            label="Camera Fixed"
            checked={params.cameraFixed}
            onChange={(v) => onChange("cameraFixed", v)}
            size="sm"
          />
          <Toggle
            label="Watermark"
            checked={params.watermark}
            onChange={(v) => onChange("watermark", v)}
            size="sm"
          />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main — Generator
// ---------------------------------------------------------------------------

export function Generator() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const elements = useElements((s) => s.items);
  const submit = useGenerations((s) => s.submit);
  const settings = useSettings();

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [prompt, setPrompt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [params, setParams] = useState<Params>({
    projectId: searchParams.get("project") ?? "",
    duration: 5,
    resolution: settings.defaultResolution || "720p",
    aspectRatio: settings.defaultAspectRatio || "16:9",
    quality: settings.defaultQuality || "standard",
    seed: "",
    cameraFixed: false,
    watermark: false,
    audioEnabled: true,
  });

  // Update project if URL param changes
  useEffect(() => {
    const p = searchParams.get("project");
    if (p) setParams((prev) => ({ ...prev, projectId: p }));
  }, [searchParams]);

  function updateParam<K extends keyof Params>(key: K, value: Params[K]) {
    setParams((prev) => ({ ...prev, [key]: value }));
  }

  // Real-time tag resolution status
  const tagMap = useMemo(
    () => new Map(elements.map((e) => [e.tag.toLowerCase(), e])),
    [elements],
  );
  const mentionedTags = useMemo(() => extractTags(prompt), [prompt]);
  const resolvedTags = mentionedTags.filter((t) => tagMap.has(t));
  const missingTags = mentionedTags.filter((t) => !tagMap.has(t));

  function handleInsertTag(tag: string) {
    if (!textareaRef.current) return;
    const { value, cursorPos } = insertAtCursor(textareaRef.current, tag);
    setPrompt(value);
    // Restore cursor after React re-render
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(cursorPos, cursorPos);
      }
    });
  }

  async function handleSubmit() {
    if (!prompt.trim()) return;
    if (!settings.apiKey) {
      setError("No API key configured. Go to Settings and save your key first.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await submit({
        prompt: prompt.trim(),
        project_id: params.projectId || null,
        duration: params.duration,
        resolution: params.resolution,
        aspect_ratio: params.aspectRatio,
        quality: params.quality,
        seed: params.seed ? parseInt(params.seed, 10) : null,
        camera_fixed: params.cameraFixed,
        watermark: params.watermark,
        audio_enabled: params.audioEnabled,
        elements,
        api: {
          endpoint: settings.apiEndpoint,
          api_key: settings.apiKey,
          model_id: settings.modelId,
        },
      });
      navigate("/");
    } catch (e) {
      setError(String(e));
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit = prompt.trim().length > 0 && !submitting;

  return (
    <div
      className="grid h-full"
      style={{ gridTemplateColumns: "280px 1fr 280px", gridTemplateRows: "1fr" }}
    >
      {/* ── Left: Element browser ─────────────────────────────── */}
      <div className="border-r border-border-hud bg-bg-panel/40 overflow-hidden flex flex-col">
        <ElementBrowser onInsert={handleInsertTag} />
      </div>

      {/* ── Center: Prompt + submit ───────────────────────────── */}
      <div className="flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-border-hud shrink-0 flex items-center justify-between">
          <div>
            <div className="hud-label text-fg-dim mb-1">// Composer</div>
            <h1 className="font-mono text-xl uppercase tracking-[0.08em] text-fg hud-text-glow-cyan">
              New Generation
            </h1>
          </div>
        </div>

        {/* Prompt area */}
        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between">
              <span className="hud-label text-fg-muted">Prompt</span>
              <span
                className={cn(
                  "font-mono text-[0.6rem] tabular-nums",
                  prompt.length > 900 ? "text-hud-red" : "text-fg-dim",
                )}
              >
                {prompt.length} / 1000
              </span>
            </div>
            <textarea
              ref={textareaRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              maxLength={1000}
              rows={10}
              placeholder={
                "Describe what you want to generate.\n\nUse @tagname to include reference elements from your library.\nExample: @hero walks through @city at dusk, cinematic lighting"
              }
              className={cn(
                "w-full bg-bg-elevated/60 border border-border-hud px-4 py-3",
                "font-mono text-sm text-fg placeholder:text-fg-dim leading-relaxed",
                "resize-none transition-colors hud-focus",
                "focus:border-hud-cyan focus:bg-bg-elevated/80",
              )}
            />
          </div>

          {/* Tag resolution chips */}
          {mentionedTags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {resolvedTags.map((tag) => {
                const el = tagMap.get(tag)!;
                const meta = ELEMENT_TYPE_META[el.type];
                return (
                  <div
                    key={tag}
                    className="flex items-center gap-1.5 px-2 py-1 border font-mono text-[0.65rem]"
                    style={{
                      borderColor: meta.color,
                      background: meta.bg,
                      color: meta.color,
                    }}
                  >
                    <CheckCircle className="w-3 h-3 shrink-0" />
                    @{tag}
                    <span className="text-fg-dim">
                      · {el.images.length} img{el.images.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                );
              })}
              {missingTags.map((tag) => (
                <div
                  key={tag}
                  className="flex items-center gap-1.5 px-2 py-1 border border-hud-red/60 bg-hud-red/5 font-mono text-[0.65rem] text-hud-red"
                >
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  @{tag}
                  <span className="text-hud-red/60">· not found</span>
                </div>
              ))}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="border border-hud-red/60 bg-hud-red/10 px-4 py-3 font-mono text-xs text-hud-red">
              {error}
            </div>
          )}

          {/* Submit */}
          <div className="flex items-center gap-4 pt-2 border-t border-border-hud">
            <Button
              onClick={handleSubmit}
              loading={submitting}
              disabled={!canSubmit}
              iconLeft={<Wand2 className="w-4 h-4" />}
              className="min-w-[160px]"
            >
              {submitting ? "Submitting…" : "Generate"}
            </Button>
            {!settings.apiKey && (
              <span className="font-mono text-[0.65rem] text-hud-amber">
                No API key — configure in Settings
              </span>
            )}
            {resolvedTags.length > 0 && (
              <span className="font-mono text-[0.65rem] text-fg-dim ml-auto">
                {resolvedTags.length} element{resolvedTags.length !== 1 ? "s" : ""} resolved
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Right: Parameters ─────────────────────────────────── */}
      <div className="border-l border-border-hud bg-bg-panel/40 overflow-hidden flex flex-col">
        <ParamsPanel params={params} onChange={updateParam} />
      </div>
    </div>
  );
}
