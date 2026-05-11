// Landing Page Editor — /landings/:landingId
//
// Renders the preset's HTML verbatim inside a contentEditable canvas.
// Text is editable in place; <img> and <video> accept drag-drop or
// click-to-upload replacements.  Edits commit on blur.

import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Edit2,
  Trash2,
  Check,
  X,
  Star,
  Monitor,
  Smartphone,
  Save,
} from "lucide-react";
import { Button, Panel } from "@/components/hud";
import { useLandings } from "@/stores/landingsStore";
import { withAlpha } from "@/lib/projectColors";
import { cn } from "@/lib/cn";
import type { LandingDocument } from "@/lib/landingTypes";
import { loadFamilyCss } from "@/components/landing/families";
import { attachMediaHandlers } from "@/components/landing/landingEditing";
import { ExportMenu } from "@/components/landing/ExportMenu";
import { SnippetPalette } from "@/components/landing/SnippetPalette";
import {
  insertSnippetIntoCanvas,
  type Snippet,
} from "@/components/landing/landingSnippets";
import { SaveAsPresetModal } from "@/components/landing/SaveAsPresetModal";

const DEFAULT_ACCENT = "#00f0ff";

export function LandingPageEditor() {
  const { landingId } = useParams<{ landingId: string }>();
  const navigate = useNavigate();

  const landing = useLandings((s) => s.items.find((l) => l.id === landingId));
  const landingsLoaded = useLandings((s) => s.loaded);
  const loadLandings = useLandings((s) => s.load);
  const updateLanding = useLandings((s) => s.update);
  const removeLanding = useLandings((s) => s.remove);
  const setStarred = useLandings((s) => s.setStarred);

  useEffect(() => {
    if (!landingsLoaded) void loadLandings();
  }, [landingsLoaded, loadLandings]);

  const [editingName, setEditingName] = useState(false);
  const [tempName, setTempName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [viewport, setViewport] = useState<"desktop" | "mobile">("desktop");
  const [familyCss, setFamilyCss] = useState<string | null>(null);
  const [savePresetOpen, setSavePresetOpen] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Lazy-load the family stylesheet for the active preset's family.
  const docCssFamily = landing?.doc.meta?.css_family ?? null;
  useEffect(() => {
    let cancelled = false;
    void loadFamilyCss(docCssFamily).then((css) => {
      if (!cancelled) setFamilyCss(css);
    });
    return () => {
      cancelled = true;
    };
  }, [docCssFamily]);

  const canvasRef = useRef<HTMLDivElement>(null);
  const renderedForRef = useRef<string | null>(null);
  const latestDocRef = useRef<LandingDocument | null>(null);
  // Keep the latest document on a ref so save handlers don't need to be
  // re-bound when React re-renders the editor.
  latestDocRef.current = landing?.doc ?? null;

  // Initial render of the document HTML into the canvas.  We avoid React's
  // controlled-rendering for the HTML body so contentEditable edits don't
  // get wiped by re-renders; instead we imperatively set innerHTML once
  // per landing and re-attach media handlers.
  useEffect(() => {
    const el = canvasRef.current;
    if (!el || !landing) return;
    if (renderedForRef.current === landing.id) return;
    el.innerHTML = landing.doc.html;
    renderedForRef.current = landing.id;
    const detach = attachMediaHandlers(el, { onChange: saveSnapshot });
    return () => {
      detach();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [landing?.id]);

  useEffect(() => {
    if (editingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [editingName]);

  function saveSnapshot() {
    const el = canvasRef.current;
    const current = latestDocRef.current;
    if (!el || !current || !landing) return;
    const html = el.innerHTML;
    if (html === current.html) return;
    void updateLanding(landing.id, { doc: { ...current, html } });
  }

  function handleInsertSnippet(snippet: Snippet) {
    const el = canvasRef.current;
    if (!el) return;
    insertSnippetIntoCanvas(el, snippet.html);
    // Re-attach media handlers so dropped images/videos inside the snippet
    // become interactive.  Replaces previous bindings (idempotent).
    attachMediaHandlers(el, { onChange: saveSnapshot });
    saveSnapshot();
  }

  if (landingsLoaded && !landing) {
    return (
      <div className="p-8 max-w-[1600px] mx-auto">
        <Link
          to="/landings"
          className="inline-flex items-center gap-2 mb-6 font-mono text-[0.7rem] uppercase tracking-[0.15em] text-fg-muted hover:text-hud-cyan transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Landings
        </Link>
        <Panel className="p-12 text-center">
          <div className="hud-label text-hud-red mb-2">// Not Found</div>
          <p className="font-mono text-xs text-fg-muted">
            No landing page found with that ID.
          </p>
        </Panel>
      </div>
    );
  }

  if (!landing) {
    return (
      <div className="p-8 flex justify-center">
        <span className="hud-label text-fg-muted hud-pulse">Loading...</span>
      </div>
    );
  }

  const accent = DEFAULT_ACCENT;
  const cssFamily = landing.doc.meta?.css_family ?? null;

  function startEditName() {
    if (!landing) return;
    setTempName(landing.name);
    setEditingName(true);
  }

  async function saveName() {
    if (!landing) return;
    const trimmed = tempName.trim();
    if (trimmed && trimmed !== landing.name) {
      await updateLanding(landing.id, { name: trimmed });
    }
    setEditingName(false);
  }

  async function handleDelete() {
    if (!landing) return;
    await removeLanding(landing.id);
    navigate("/landings");
  }

  return (
    <div className="p-8 max-w-[1600px] mx-auto">
      <Link
        to="/landings"
        className="inline-flex items-center gap-2 mb-6 font-mono text-[0.7rem] uppercase tracking-[0.15em] text-fg-muted hover:text-hud-cyan transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to Landings
      </Link>

      <header className="mb-8">
        <div className="hud-label mb-2" style={{ color: accent }}>
          // Landing Page · preset: {landing.preset_id}
        </div>

        {editingName ? (
          <input
            ref={nameInputRef}
            type="text"
            value={tempName}
            onChange={(e) => setTempName(e.target.value)}
            onBlur={saveName}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveName();
              if (e.key === "Escape") setEditingName(false);
            }}
            className="bg-bg-elevated/60 border-b-2 px-2 py-1 mb-3 font-mono text-2xl uppercase tracking-[0.08em] text-fg focus:outline-none"
            style={{ borderColor: accent }}
            maxLength={120}
          />
        ) : (
          <div className="flex items-center gap-3 mb-3">
            <button
              type="button"
              onClick={startEditName}
              className="group flex items-center gap-3 hud-focus"
            >
              <h1
                className="font-mono text-2xl uppercase tracking-[0.08em] text-fg"
                style={{
                  textShadow: `0 0 8px ${withAlpha(accent, 0.6)}, 0 0 16px ${withAlpha(accent, 0.3)}`,
                }}
              >
                {landing.name}
              </h1>
              <Edit2 className="w-3.5 h-3.5 text-fg-dim opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
            <button
              type="button"
              onClick={() => void setStarred(landing.id, !landing.starred)}
              className={cn(
                "p-1.5 rounded border transition-colors",
                landing.starred
                  ? "text-hud-amber border-hud-amber/60 bg-hud-amber/10"
                  : "text-fg-dim border-border-hud hover:text-hud-amber hover:border-hud-amber/60",
              )}
              title={landing.starred ? "Unstar" : "Star"}
            >
              <Star
                className="w-4 h-4"
                strokeWidth={1.6}
                fill={landing.starred ? "currentColor" : "none"}
              />
            </button>
          </div>
        )}

        <div className="flex items-center gap-5 mt-4 flex-wrap">
          <span className="hud-label text-fg-dim">
            UPDATED {new Date(landing.updated_at).toLocaleString()}
          </span>

          <div className="flex-1" />

          {/* Viewport toggle */}
          <div className="inline-flex border border-border-hud">
            <button
              type="button"
              onClick={() => setViewport("desktop")}
              className={cn(
                "p-1.5 transition-colors",
                viewport === "desktop"
                  ? "bg-hud-cyan/15 text-hud-cyan"
                  : "text-fg-muted hover:text-fg",
              )}
              title="Desktop preview"
            >
              <Monitor className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewport("mobile")}
              className={cn(
                "p-1.5 border-l border-border-hud transition-colors",
                viewport === "mobile"
                  ? "bg-hud-cyan/15 text-hud-cyan"
                  : "text-fg-muted hover:text-fg",
              )}
              title="Mobile preview"
            >
              <Smartphone className="w-3.5 h-3.5" />
            </button>
          </div>

          <Button
            variant="secondary"
            size="sm"
            iconLeft={<Save className="w-3.5 h-3.5" />}
            onClick={() => setSavePresetOpen(true)}
            title="Save current landing as a reusable preset"
          >
            Save as Preset
          </Button>

          <ExportMenu
            doc={landing.doc}
            fileSlug={
              landing.name
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/^-+|-+$/g, "")
                .slice(0, 60) || "landing-page"
            }
            pageTitle={landing.name}
          />

          {confirmDelete ? (
            <div className="flex items-center gap-2">
              <span className="hud-label text-hud-red">Delete landing?</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirmDelete(false)}
              >
                <X className="w-3.5 h-3.5" />
              </Button>
              <Button variant="danger" size="sm" onClick={handleDelete}>
                <Check className="w-3.5 h-3.5" />
              </Button>
            </div>
          ) : (
            <Button
              variant="danger"
              size="sm"
              iconLeft={<Trash2 className="w-3.5 h-3.5" />}
              onClick={() => setConfirmDelete(true)}
            >
              Delete
            </Button>
          )}
        </div>
      </header>

      {/* Canvas — verbatim preset HTML, edited in place. */}
      <div
        className={cn(
          "relative rounded-md border border-border-hud shadow-2xl bg-white overflow-hidden transition-[max-width] duration-200",
          viewport === "mobile" && "max-w-[420px] mx-auto",
        )}
      >
        {familyCss && <style dangerouslySetInnerHTML={{ __html: familyCss }} />}
        <div
          ref={canvasRef}
          contentEditable
          suppressContentEditableWarning
          spellCheck={false}
          onBlur={saveSnapshot}
          data-lp-family={cssFamily ?? undefined}
          className="lp-canvas relative outline-none focus:outline-none"
        />
      </div>

      <p className="mt-4 text-center font-mono text-[0.65rem] uppercase tracking-[0.15em] text-fg-dim">
        Click any text to edit · Click or drag a file onto any image / video to replace · Auto-saves on blur · Insert blocks with the + button
      </p>

      <SnippetPalette onPick={handleInsertSnippet} />

      <SaveAsPresetModal
        open={savePresetOpen}
        onClose={() => setSavePresetOpen(false)}
        defaultName={`${landing.name} (preset)`}
        html={landing.doc.html}
        cssFamily={cssFamily}
      />
    </div>
  );
}
