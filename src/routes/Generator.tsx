import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import {
  Search,
  Wand2,
  CheckCircle,
  AlertCircle,
  Hash,
  History,
  ImagePlus,
  X,
} from "lucide-react";
import { Button, Toggle, Select, Slider } from "@/components/hud";
import { useElements } from "@/stores/elementsStore";
import { useProjects } from "@/stores/projectsStore";
import { useGenerations } from "@/stores/generationsStore";
import { useSettings } from "@/stores/settingsStore";
import { ELEMENT_TYPES, ELEMENT_TYPE_META, type ElementType } from "@/lib/elementTypes";
import type { DirectReference } from "@/lib/tagResolver";
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

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

// ---------------------------------------------------------------------------
// Direct reference upload strip
// ---------------------------------------------------------------------------

const MAX_DIRECT_REFS = 5;
const MAX_REF_SIZE = 30 * 1024 * 1024; // 30 MB
const ALLOWED_REF_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "video/mp4",
  "video/webm",
  "video/quicktime",
];

const ROLE_META: Record<
  DirectReference["role"],
  { label: string; color: string }
> = {
  reference_image: { label: "ref",   color: "#22d3ee" }, // cyan
  first_frame:     { label: "start", color: "#f59e0b" }, // amber
  last_frame:      { label: "end",   color: "#f59e0b" }, // amber
  reference_video: { label: "video", color: "#a78bfa" }, // violet
};

const IMAGE_ROLES: DirectReference["role"][] = [
  "reference_image",
  "first_frame",
  "last_frame",
];

/** Compute the @tag for a direct ref based on its position among same-type refs. */
function computeRefTag(ref: DirectReference, allRefs: DirectReference[]): string {
  const sameType = allRefs.filter((r) => r.type === ref.type);
  const idx = sameType.findIndex((r) => r.id === ref.id);
  return ref.type === "image" ? `image${idx + 1}` : `video${idx + 1}`;
}

interface DirectRefsStripProps {
  refs: DirectReference[];
  onAdd: (files: FileList) => void;
  onRemove: (id: string) => void;
  onCycleRole: (id: string) => void;
  onInsertTag: (tag: string) => void;
}

function DirectRefsStrip({ refs, onAdd, onRemove, onCycleRole, onInsertTag }: DirectRefsStripProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (refs.length < MAX_DIRECT_REFS) setIsDragOver(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    // Only clear if leaving the container itself, not a child
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onAdd(e.dataTransfer.files);
    }
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="hud-label text-fg-muted">Direct References</span>
        <span className="font-mono text-[0.6rem] text-fg-dim">
          {refs.length}/{MAX_DIRECT_REFS} · drag &amp; drop or click Add · @tag to reference in prompt
        </span>
      </div>

      <div
        className={cn(
          "relative flex flex-wrap gap-2 p-2 min-h-[88px] border bg-bg-elevated/20",
          "items-start content-start transition-colors",
          isDragOver
            ? "border-hud-cyan bg-hud-cyan/5 border-dashed"
            : "border-border-hud",
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {refs.map((ref) => {
          const meta = ROLE_META[ref.role];
          const refTag = computeRefTag(ref, refs);
          return (
            <div
              key={ref.id}
              className="relative w-[72px] h-[72px] group shrink-0 border border-border-hud overflow-hidden"
            >
              {ref.type === "image" ? (
                <img
                  src={ref.data_url}
                  alt={ref.file_name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <video
                  src={ref.data_url}
                  className="w-full h-full object-cover"
                  muted
                />
              )}

              {/* @tag badge — click to insert into prompt */}
              <button
                type="button"
                onClick={() => onInsertTag(`@${refTag}`)}
                title={`Click to insert @${refTag} into prompt`}
                className="absolute top-0 left-0 font-mono text-[0.45rem] px-1 py-0.5 text-hud-cyan hover:text-white transition-colors"
                style={{ background: "rgba(0,0,0,0.80)" }}
              >
                @{refTag}
              </button>

              {/* Role badge — click to cycle for images */}
              {ref.type === "image" ? (
                <button
                  type="button"
                  onClick={() => onCycleRole(ref.id)}
                  title="Click to change role"
                  className="absolute bottom-0 left-0 right-0 font-mono text-[0.5rem] uppercase text-center py-0.5 tracking-wider"
                  style={{ background: "rgba(0,0,0,0.75)", color: meta.color }}
                >
                  {meta.label}
                </button>
              ) : (
                <div
                  className="absolute bottom-0 left-0 right-0 font-mono text-[0.5rem] uppercase text-center py-0.5 tracking-wider"
                  style={{ background: "rgba(0,0,0,0.75)", color: meta.color }}
                >
                  {meta.label}
                </div>
              )}

              {/* Remove button */}
              <button
                type="button"
                onClick={() => onRemove(ref.id)}
                className="absolute top-0.5 right-0.5 w-4 h-4 bg-bg-base/80 border border-hud-red/60 text-hud-red flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label="Remove"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </div>
          );
        })}

        {refs.length < MAX_DIRECT_REFS && (
          <label className="w-[72px] h-[72px] border border-dashed border-border-hud hover:border-hud-cyan/60 bg-bg-elevated/40 hover:bg-hud-cyan/5 transition-colors flex flex-col items-center justify-center gap-1 cursor-pointer shrink-0">
            <ImagePlus className="w-4 h-4 text-fg-muted" strokeWidth={1.2} />
            <span className="font-mono text-[0.5rem] uppercase text-fg-dim">Add</span>
            <input
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime"
              onChange={(e) => {
                if (e.target.files) {
                  onAdd(e.target.files);
                  e.target.value = "";
                }
              }}
              className="hidden"
            />
          </label>
        )}

        {isDragOver && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="font-mono text-[0.7rem] text-hud-cyan">
              Drop to add reference
            </span>
          </div>
        )}

        {refs.length === 0 && !isDragOver && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="font-mono text-[0.65rem] text-fg-dim text-center px-4">
              Drag &amp; drop images or video clips — or click Add
            </span>
          </div>
        )}
      </div>

      {refs.some((r) => r.role === "first_frame" || r.role === "last_frame") &&
        refs.some((r) => r.role === "reference_image") && (
          <p className="font-mono text-[0.6rem] text-hud-amber">
            ⚠ Mixing "ref" with "start"/"end" roles may be rejected by the API — keep modes separate.
          </p>
        )}
    </div>
  );
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
              {items.length === 0
                ? "No elements yet. Add some in the Elements library."
                : "No matches."}
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
                <Hash className="w-3 h-3 text-fg-dim opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
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

interface Params {
  projectId: string;
  duration: number;
  resolution: string;
  aspectRatio: string;
  seed: string;
  cameraFixed: boolean;
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
          min={4}
          max={15}
          step={1}
          ticks={[4, 5, 8, 10, 15]}
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
  const location = useLocation();
  const draft = (location.state as { draft?: Partial<Params> } | null)?.draft;

  const elements = useElements((s) => s.items);
  const submit = useGenerations((s) => s.submit);
  const allGenerations = useGenerations((s) => s.items);
  const settings = useSettings();

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [prompt, setPrompt] = useState((draft as { prompt?: string } | undefined)?.prompt ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [directRefs, setDirectRefs] = useState<DirectReference[]>([]);
  const [skipImages, setSkipImages] = useState(false);

  // Recent unique prompts from past generations (newest first, max 20)
  const promptHistory = useMemo(() => {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const g of allGenerations) {
      const p = g.prompt_raw.trim();
      if (p && !seen.has(p)) {
        seen.add(p);
        result.push(p);
        if (result.length >= 20) break;
      }
    }
    return result;
  }, [allGenerations]);

  const [params, setParams] = useState<Params>({
    projectId: searchParams.get("project") ?? "",
    duration: draft?.duration ?? 5,
    resolution: draft?.resolution ?? settings.defaultResolution ?? "720p",
    aspectRatio: draft?.aspectRatio ?? settings.defaultAspectRatio ?? "16:9",
    seed: draft?.seed ?? "",
    cameraFixed: draft?.cameraFixed ?? false,
    audioEnabled: draft?.audioEnabled ?? true,
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

  // Compute auto-tags for direct refs (@image1, @video1, …)
  const directRefTagMap = useMemo(() => {
    const map = new Map<string, DirectReference>();
    const imageCounts: string[] = [];
    const videoCounts: string[] = [];
    for (const ref of directRefs) {
      if (ref.type === "image") {
        const tag = `image${imageCounts.length + 1}`;
        imageCounts.push(tag);
        map.set(tag, ref);
      } else {
        const tag = `video${videoCounts.length + 1}`;
        videoCounts.push(tag);
        map.set(tag, ref);
      }
    }
    return map;
  }, [directRefs]);

  const mentionedTags = useMemo(() => extractTags(prompt), [prompt]);
  const resolvedTags = mentionedTags.filter((t) => tagMap.has(t) || directRefTagMap.has(t));
  const missingTags = mentionedTags.filter((t) => !tagMap.has(t) && !directRefTagMap.has(t));

  function handleInsertTag(tag: string) {
    if (!textareaRef.current) return;
    const { value, cursorPos } = insertAtCursor(textareaRef.current, tag);
    setPrompt(value);
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(cursorPos, cursorPos);
      }
    });
  }

  // ── Direct reference handlers ─────────────────────────────────────────────

  function handleAddDirectRefs(files: FileList) {
    const arr = Array.from(files).filter(
      (f) => ALLOWED_REF_TYPES.includes(f.type) && f.size <= MAX_REF_SIZE,
    );
    const slotsLeft = MAX_DIRECT_REFS - directRefs.length;
    void Promise.all(
      arr.slice(0, slotsLeft).map(async (file) => ({
        id: crypto.randomUUID(),
        type: (file.type.startsWith("video/") ? "video" : "image") as DirectReference["type"],
        role: (file.type.startsWith("video/")
          ? "reference_video"
          : "reference_image") as DirectReference["role"],
        data_url: await readAsDataUrl(file),
        file_name: file.name,
      })),
    ).then((newRefs) => setDirectRefs((prev) => [...prev, ...newRefs]));
  }

  function removeDirectRef(id: string) {
    setDirectRefs((prev) => prev.filter((r) => r.id !== id));
  }

  function cycleDirectRefRole(id: string) {
    setDirectRefs((prev) =>
      prev.map((ref) => {
        if (ref.id !== id || ref.type === "video") return ref;
        const idx = IMAGE_ROLES.indexOf(ref.role as (typeof IMAGE_ROLES)[number]);
        return { ...ref, role: IMAGE_ROLES[(idx + 1) % IMAGE_ROLES.length] };
      }),
    );
  }

  // ── Submit ─────────────────────────────────────────────────────────────────

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
        seed: params.seed ? parseInt(params.seed, 10) : null,
        camera_fixed: params.cameraFixed,
        watermark: false,
        audio_enabled: params.audioEnabled,
        directRefs: skipImages ? [] : directRefs,
        elements: skipImages ? [] : elements,
        api: {
          endpoint: settings.apiEndpoint,
          api_key: settings.apiKey,
          model_id: settings.modelId,
          imgbb_api_key: settings.imgbbApiKey || undefined,
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

      {/* ── Center: Prompt + references + submit ─────────────── */}
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

        {/* Scrollable content area */}
        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4">

          {/* Prompt */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="hud-label text-fg-muted">Prompt</span>
              <div className="flex items-center gap-3">
                {promptHistory.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowHistory((v) => !v)}
                    className={cn(
                      "flex items-center gap-1 font-mono text-[0.6rem] transition-colors",
                      showHistory ? "text-hud-cyan" : "text-fg-dim hover:text-fg",
                    )}
                  >
                    <History className="w-3 h-3" />
                    History
                  </button>
                )}
              </div>
            </div>
            <textarea
              ref={textareaRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && canSubmit) {
                  e.preventDefault();
                  void handleSubmit();
                }
              }}
              rows={8}
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

          {/* Prompt history dropdown */}
          {showHistory && promptHistory.length > 0 && (
            <div className="border border-hud-cyan/40 bg-bg-panel/95 backdrop-blur-sm divide-y divide-border-hud/40 max-h-48 overflow-y-auto">
              <div className="px-3 py-1.5 flex items-center justify-between">
                <span className="hud-label text-fg-dim">// Recent Prompts</span>
                <button
                  type="button"
                  onClick={() => setShowHistory(false)}
                  className="font-mono text-[0.6rem] text-fg-dim hover:text-fg transition-colors"
                >
                  Close
                </button>
              </div>
              {promptHistory.map((p, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    setPrompt(p);
                    setShowHistory(false);
                    textareaRef.current?.focus();
                  }}
                  className="w-full text-left px-3 py-2 font-mono text-xs text-fg-muted hover:text-fg hover:bg-bg-elevated/60 transition-colors line-clamp-2 leading-relaxed"
                >
                  {p}
                </button>
              ))}
            </div>
          )}

          {/* Direct references */}
          <DirectRefsStrip
            refs={directRefs}
            onAdd={handleAddDirectRefs}
            onRemove={removeDirectRef}
            onCycleRole={cycleDirectRefRole}
            onInsertTag={handleInsertTag}
          />

          {/* Tag resolution chips */}
          {mentionedTags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {resolvedTags.map((tag) => {
                const directRef = directRefTagMap.get(tag);
                if (directRef) {
                  // Direct reference tag (@image1, @video1, …)
                  return (
                    <div
                      key={tag}
                      className="flex items-center gap-1.5 px-2 py-1 border border-hud-cyan/60 bg-hud-cyan/5 font-mono text-[0.65rem] text-hud-cyan"
                    >
                      <CheckCircle className="w-3 h-3 shrink-0" />
                      @{tag}
                      <span className="text-hud-cyan/60">
                        · direct {directRef.type}
                      </span>
                    </div>
                  );
                }
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
            <div className="border border-hud-red/60 bg-hud-red/10 px-4 py-3 font-mono text-xs text-hud-red space-y-1">
              {error.includes("InputImageSensitiveContentDetected") ? (
                <>
                  <div className="text-hud-amber font-bold">
                    ⚠ BytePlus blocked the reference image: real person detected
                  </div>
                  <div className="text-hud-amber/80 text-[0.65rem] leading-relaxed">
                    BytePlus content policy rejects photorealistic human faces as reference inputs (anti-deepfake measure).
                    Enable <strong>"Skip images"</strong> below to generate from text only, or use an illustrated / 3D render
                    character image instead. For enterprise access with this restriction lifted, contact BytePlus.
                  </div>
                </>
              ) : (
                <span>{error}</span>
              )}
            </div>
          )}

          {/* Submit */}
          <div className="flex flex-col gap-2 pt-2 border-t border-border-hud">
            <div className="flex items-center gap-4">
              <Button
                onClick={handleSubmit}
                loading={submitting}
                disabled={!canSubmit}
                iconLeft={<Wand2 className="w-4 h-4" />}
                className="min-w-[160px]"
              >
                {submitting ? "Submitting…" : "Generate"}
              </Button>
              {!settings.apiKey ? (
                <span className="font-mono text-[0.65rem] text-hud-amber">
                  No API key — configure in Settings
                </span>
              ) : (
                <span className="font-mono text-[0.6rem] text-fg-dim">
                  Ctrl+Enter to generate
                </span>
              )}
              {(resolvedTags.length > 0 || directRefs.length > 0) && (
                <span className="font-mono text-[0.65rem] text-fg-dim ml-auto">
                  {resolvedTags.length > 0 && `${resolvedTags.length} element${resolvedTags.length !== 1 ? "s" : ""}`}
                  {resolvedTags.length > 0 && directRefs.length > 0 && " · "}
                  {directRefs.length > 0 && `${directRefs.length} direct ref${directRefs.length !== 1 ? "s" : ""}`}
                </span>
              )}
            </div>
            {/* Skip images toggle — shown only when there are refs, useful for BytePlus real-person policy */}
            {(resolvedTags.length > 0 || directRefs.length > 0) && (
              <label className="flex items-center gap-2 cursor-pointer self-start">
                <input
                  type="checkbox"
                  checked={skipImages}
                  onChange={(e) => setSkipImages(e.target.checked)}
                  className="accent-hud-amber w-3 h-3"
                />
                <span className="font-mono text-[0.6rem] text-fg-dim">
                  Skip images (text prompt only) —{" "}
                  <span className="text-hud-amber">
                    use if BytePlus blocks real person photos
                  </span>
                </span>
              </label>
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
