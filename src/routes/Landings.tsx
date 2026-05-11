// Landings — top-level list of landing pages with per-card star,
// duplicate, and delete actions.

import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, FileText, Star, Copy, Trash2, Check, X } from "lucide-react";
import { Button, Panel } from "@/components/hud";
import { useLandings, type LandingPage } from "@/stores/landingsStore";
import { isTauri } from "@/lib/tauri";
import { PresetPicker } from "@/components/landing/PresetPicker";
import { docFromPreset, getPreset, type Preset } from "@/components/landing/presets";
import { toast } from "@/stores/toastStore";
import { cn } from "@/lib/cn";

export function Landings() {
  const items = useLandings((s) => s.items);
  const loaded = useLandings((s) => s.loaded);
  const load = useLandings((s) => s.load);
  const create = useLandings((s) => s.create);
  const setStarred = useLandings((s) => s.setStarred);
  const duplicate = useLandings((s) => s.duplicate);
  const remove = useLandings((s) => s.remove);
  const navigate = useNavigate();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (!loaded) void load();
  }, [loaded, load]);

  async function handleSelectPreset(preset: Preset) {
    const doc = await docFromPreset(preset);
    const created = await create({
      name: preset.name,
      preset_id: preset.id,
      doc,
    });
    setPickerOpen(false);
    navigate(`/landings/${created.id}`);
  }

  async function handleDuplicate(landing: LandingPage) {
    const dup = await duplicate(landing.id);
    if (dup) toast.success("Duplicated", dup.name);
  }

  async function handleDelete(id: string) {
    await remove(id);
    setConfirmDeleteId(null);
    toast.success("Landing deleted");
  }

  return (
    <div className="p-8 max-w-[1600px] mx-auto">
      <header className="mb-6 flex items-end justify-between">
        <div>
          <div className="hud-label text-fg-dim mb-1">// Page Builder</div>
          <h1 className="font-mono text-2xl uppercase tracking-[0.08em] text-fg hud-text-glow-cyan">
            Landings
          </h1>
          <div className="font-mono text-xs text-fg-muted mt-2">
            {items.length} {items.length === 1 ? "page" : "pages"}
          </div>
        </div>
        <Button
          iconLeft={<Plus className="w-4 h-4" />}
          onClick={() => setPickerOpen(true)}
          disabled={!isTauri}
        >
          New Landing Page
        </Button>
      </header>

      {!isTauri && (
        <div className="mb-4 border border-hud-amber/40 bg-hud-amber/5 px-4 py-3">
          <div className="hud-label text-hud-amber mb-1">Preview Mode</div>
          <p className="font-mono text-[0.7rem] text-fg-muted">
            Landing creation requires the Tauri runtime. Run{" "}
            <span className="text-hud-cyan">npm run tauri dev</span> for full
            functionality.
          </p>
        </div>
      )}

      {!loaded ? (
        <Panel className="p-16 hud-grid-bg">
          <div className="flex justify-center">
            <span className="hud-label text-fg-muted hud-pulse">
              Loading landings...
            </span>
          </div>
        </Panel>
      ) : items.length === 0 ? (
        <Panel className="p-16 hud-grid-bg">
          <div className="flex flex-col items-center justify-center text-center gap-4">
            <div className="relative w-16 h-16 border border-border-hud flex items-center justify-center">
              <FileText className="w-7 h-7 text-fg-dim" strokeWidth={1.2} />
            </div>
            <div className="space-y-1">
              <h2 className="font-mono uppercase tracking-[0.15em] text-fg">
                No Landing Pages Yet
              </h2>
              <p className="font-mono text-xs text-fg-muted max-w-md">
                Pick a preset (or start blank), edit text inline, drag-drop
                images / GIFs / videos into slots, and export the final
                HTML when you're done.
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPickerOpen(true)}
              disabled={!isTauri}
            >
              Choose a Preset
            </Button>
          </div>
        </Panel>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {items.map((l) => {
            const preset = getPreset(l.preset_id);
            const confirmingDelete = confirmDeleteId === l.id;
            return (
              <div key={l.id} className="group/card relative">
                <Link to={`/landings/${l.id}`} className="block">
                  <Panel className="overflow-hidden transition-colors group-hover/card:border-hud-cyan">
                    {preset?.thumbnail_src ? (
                      <div className="aspect-video bg-bg-base relative overflow-hidden">
                        <img
                          src={preset.thumbnail_src}
                          alt=""
                          className="absolute inset-0 w-full h-full object-cover opacity-70 group-hover/card:opacity-90 transition-opacity"
                          loading="lazy"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
                          }}
                        />
                      </div>
                    ) : (
                      <div className="aspect-video bg-bg-base flex items-center justify-center">
                        <FileText className="w-8 h-8 text-fg-dim" strokeWidth={1.2} />
                      </div>
                    )}
                    <div className="p-4">
                      <div className="hud-label text-fg-dim mb-1">
                        // {l.preset_id}
                      </div>
                      <div className="font-mono text-sm uppercase tracking-[0.06em] text-fg group-hover/card:text-hud-cyan transition-colors truncate">
                        {l.name}
                      </div>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="hud-label text-fg-dim">
                          {new Date(l.updated_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </Panel>
                </Link>

                {/* Star — always visible if starred, hover-only otherwise */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    void setStarred(l.id, !l.starred);
                  }}
                  className={cn(
                    "absolute top-2 left-2 p-1.5 rounded transition-all",
                    "bg-bg-base/80 backdrop-blur-sm",
                    l.starred
                      ? "text-hud-amber border border-hud-amber/60 opacity-100"
                      : "text-fg-muted border border-border-hud opacity-0 group-hover/card:opacity-100 hover:text-hud-amber hover:border-hud-amber/60",
                  )}
                  title={l.starred ? "Unstar" : "Star"}
                >
                  <Star
                    className="w-3.5 h-3.5"
                    strokeWidth={1.6}
                    fill={l.starred ? "currentColor" : "none"}
                  />
                </button>

                {/* Bottom action bar — duplicate + delete on hover */}
                <div
                  className={cn(
                    "absolute top-2 right-2 flex items-center gap-1 transition-opacity",
                    confirmingDelete
                      ? "opacity-100"
                      : "opacity-0 group-hover/card:opacity-100",
                  )}
                >
                  {confirmingDelete ? (
                    <>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setConfirmDeleteId(null);
                        }}
                        className="p-1.5 bg-bg-base/85 border border-border-hud text-fg-muted hover:text-fg backdrop-blur-sm rounded"
                        title="Cancel"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          void handleDelete(l.id);
                        }}
                        className="p-1.5 bg-hud-red/15 border border-hud-red/60 text-hud-red hover:bg-hud-red/25 backdrop-blur-sm rounded"
                        title="Confirm delete"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          void handleDuplicate(l);
                        }}
                        className="p-1.5 bg-bg-base/80 backdrop-blur-sm border border-border-hud text-fg-muted hover:text-hud-cyan hover:border-hud-cyan rounded"
                        title="Duplicate"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setConfirmDeleteId(l.id);
                        }}
                        className="p-1.5 bg-bg-base/80 backdrop-blur-sm border border-border-hud text-fg-muted hover:text-hud-red hover:border-hud-red rounded"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <PresetPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={handleSelectPreset}
      />
    </div>
  );
}
