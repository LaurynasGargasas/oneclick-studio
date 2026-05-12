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
import { loadFamilyCssForEditor } from "@/components/landing/families";
import {
  attachMediaHandlers,
  executeScripts,
  transformInlineMediaToContainer,
} from "@/components/landing/landingEditing";
import { attachSectionReorder } from "@/components/landing/landingReorder";
import { serializeCanvas } from "@/components/landing/landingSerialize";
import { FormattingToolbar } from "@/components/landing/FormattingToolbar";
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
  // Editor variant: width @media → @container so the mobile-preview
  // toggle (which only narrows the canvas) reflows correctly.
  const docCssFamily = landing?.doc.meta?.css_family ?? null;
  useEffect(() => {
    let cancelled = false;
    void loadFamilyCssForEditor(docCssFamily).then((css) => {
      if (!cancelled) setFamilyCss(css);
    });
    return () => {
      cancelled = true;
    };
  }, [docCssFamily]);

  const canvasRef = useRef<HTMLDivElement>(null);
  const [canvasEl, setCanvasEl] = useState<HTMLDivElement | null>(null);
  const renderedForRef = useRef<string | null>(null);
  const latestDocRef = useRef<LandingDocument | null>(null);
  const detachersRef = useRef<Array<() => void>>([]);
  // Keep the latest document on a ref so save handlers don't need to be
  // re-bound when React re-renders the editor.
  latestDocRef.current = landing?.doc ?? null;

  // ── Undo / redo history ───────────────────────────────────────────
  // Snapshot-based: every meaningful change pushes the prior html onto
  // `undoStack`.  Cmd/Ctrl-Z pops one off, restores it, and pushes the
  // current state onto `redoStack`.  Cmd/Ctrl-Shift-Z does the inverse.
  //
  // Typing isn't snapshotted per-keystroke (too expensive); instead a
  // 700ms debounced `input` listener captures a snapshot after a typing
  // burst.  Structural mutations (snippet insert, image replace, section
  // reorder, formatting toolbar) hit saveSnapshot synchronously and
  // capture their own snapshots.
  const undoStackRef = useRef<string[]>([]);
  const redoStackRef = useRef<string[]>([]);
  const lastHtmlRef = useRef<string>("");
  const typingTimerRef = useRef<number | null>(null);
  const restoringRef = useRef(false);

  const MAX_HISTORY = 100;

  function pushHistory(nextHtml: string) {
    if (nextHtml === lastHtmlRef.current) return;
    if (lastHtmlRef.current !== "") {
      undoStackRef.current.push(lastHtmlRef.current);
      if (undoStackRef.current.length > MAX_HISTORY) {
        undoStackRef.current.shift();
      }
    }
    // Any fresh change invalidates the redo branch.
    redoStackRef.current = [];
    lastHtmlRef.current = nextHtml;
  }

  function applyHtml(html: string) {
    const el = canvasRef.current;
    const current = latestDocRef.current;
    if (!el || !current || !landing) return;
    restoringRef.current = true;
    el.innerHTML = html;
    transformInlineMediaToContainer(el);
    lastHtmlRef.current = html;
    executeScripts(el);
    attachAll(el);
    void updateLanding(landing.id, { doc: { ...current, html } });
    // Allow input events to fire again next tick.
    requestAnimationFrame(() => {
      restoringRef.current = false;
    });
  }

  function undo() {
    if (undoStackRef.current.length === 0) return;
    const prev = undoStackRef.current.pop()!;
    redoStackRef.current.push(lastHtmlRef.current);
    applyHtml(prev);
  }

  function redo() {
    if (redoStackRef.current.length === 0) return;
    const next = redoStackRef.current.pop()!;
    undoStackRef.current.push(lastHtmlRef.current);
    applyHtml(next);
  }

  function setCanvasRef(node: HTMLDivElement | null) {
    canvasRef.current = node;
    setCanvasEl(node);
  }

  function detachAll() {
    detachersRef.current.forEach((fn) => {
      try {
        fn();
      } catch {
        /* ignore */
      }
    });
    detachersRef.current = [];
  }

  function attachAll(el: HTMLElement) {
    detachAll();
    detachersRef.current.push(
      attachMediaHandlers(el, { onChange: saveSnapshot }),
      attachSectionReorder(el, { onChange: saveSnapshot }),
    );
  }

  // Initial render of the document HTML into the canvas.  We avoid React's
  // controlled-rendering for the HTML body so contentEditable edits don't
  // get wiped by re-renders; instead we imperatively set innerHTML once
  // per landing and re-attach media + reorder handlers.
  useEffect(() => {
    const el = canvasRef.current;
    if (!el || !landing) return;
    if (renderedForRef.current === landing.id) return;
    el.innerHTML = landing.doc.html;
    transformInlineMediaToContainer(el);
    renderedForRef.current = landing.id;
    lastHtmlRef.current = landing.doc.html;
    undoStackRef.current = [];
    redoStackRef.current = [];
    executeScripts(el);
    attachAll(el);
    return () => {
      detachAll();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [landing?.id]);

  // Debounced typing snapshot: after 700ms of no input, capture state
  // so Cmd-Z gives the user chunk-sized undos rather than wiping the
  // whole typing burst.
  useEffect(() => {
    if (!canvasEl) return;
    function onInput() {
      if (restoringRef.current) return;
      if (typingTimerRef.current) {
        window.clearTimeout(typingTimerRef.current);
      }
      typingTimerRef.current = window.setTimeout(() => {
        saveSnapshot();
      }, 700);
    }
    canvasEl.addEventListener("input", onInput);
    return () => {
      canvasEl.removeEventListener("input", onInput);
      if (typingTimerRef.current) {
        window.clearTimeout(typingTimerRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasEl]);

  // Cmd/Ctrl-Z (undo) + Cmd/Ctrl-Shift-Z or Cmd/Ctrl-Y (redo).  We
  // always preventDefault so the browser's native contentEditable undo
  // doesn't fire alongside ours — keeps history coherent.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const cmd = e.metaKey || e.ctrlKey;
      if (!cmd) return;
      const key = e.key.toLowerCase();
      if (key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((key === "z" && e.shiftKey) || key === "y") {
        e.preventDefault();
        redo();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    if (restoringRef.current) return;
    const html = serializeCanvas(el);
    if (html === current.html) return;
    pushHistory(html);
    void updateLanding(landing.id, { doc: { ...current, html } });
  }

  function handleInsertSnippet(snippet: Snippet) {
    const el = canvasRef.current;
    if (!el) return;
    insertSnippetIntoCanvas(el, snippet.html);
    // If the snippet bundles inline styles with @media queries, rewrite
    // them to @container so they react to canvas width.
    transformInlineMediaToContainer(el);
    // Re-bind handlers so the newly-inserted DOM also picks up
    // section-reorder and media drag/drop.
    attachAll(el);
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
          ref={setCanvasRef}
          contentEditable
          suppressContentEditableWarning
          spellCheck={false}
          onBlur={saveSnapshot}
          data-lp-family={cssFamily ?? undefined}
          className="lp-canvas relative outline-none focus:outline-none"
          // `container-type: inline-size` makes the canvas a container-
          // query context, so the width breakpoints rewritten from @media
          // to @container in loadFamilyCss() fire based on canvas width
          // rather than viewport width.  Without this, mobile preview is
          // just a clipped desktop layout.
          style={{ containerType: "inline-size" }}
        />
      </div>

      <p className="mt-4 text-center font-mono text-[0.65rem] uppercase tracking-[0.15em] text-fg-dim">
        Click any text to edit · Select text to format · Drag the handle to reorder a section · Drop a file on any image / video to replace · + to insert blocks · ⌘Z / ⌃Z to undo
      </p>

      <FormattingToolbar canvas={canvasEl} onChange={saveSnapshot} />
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
