import { useEffect } from "react";
import { ImageOff, FileText, Trash2 } from "lucide-react";
import { Modal } from "@/components/hud";
import { PRESETS, type Preset } from "@/components/landing/presets";
import { useUserPresets, type UserPreset } from "@/stores/userPresetsStore";
import { cn } from "@/lib/cn";

interface PresetPickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (preset: Preset) => void;
}

// Convert a stored user preset into the unified Preset shape so the
// picker can render them identically.  `family` is arbitrary for user
// presets — it isn't used after conversion (css_family drives styling).
function userPresetToPreset(u: UserPreset): Preset {
  return {
    id: `user:${u.id}`,
    name: u.name,
    family: "blank",
    css_family: u.css_family,
    description: u.description ?? "",
    thumbnail_src: u.thumbnail_src ?? undefined,
    is_user: true,
    loadHtml: () => Promise.resolve(u.html),
  };
}

const FAMILY_LABEL: Record<Preset["family"], string> = {
  blank: "Blank",
  "advertorial-story": "Advertorial",
  "crisis-problem": "Crisis Exposé",
  "ranking-listicle": "Ranking",
  "ten-reasons-listicle": "10 Reasons",
};

const FAMILY_COLOR: Record<Preset["family"], string> = {
  blank: "text-fg-dim border-fg-dim/40",
  "advertorial-story": "text-hud-cyan border-hud-cyan/40",
  "crisis-problem": "text-hud-red border-hud-red/40",
  "ranking-listicle": "text-hud-amber border-hud-amber/40",
  "ten-reasons-listicle": "text-hud-magenta border-hud-magenta/40",
};

export function PresetPicker({ open, onClose, onSelect }: PresetPickerProps) {
  const userPresets = useUserPresets((s) => s.items);
  const userLoaded = useUserPresets((s) => s.loaded);
  const loadUserPresets = useUserPresets((s) => s.load);
  const removeUserPreset = useUserPresets((s) => s.remove);

  useEffect(() => {
    if (open && !userLoaded) void loadUserPresets();
  }, [open, userLoaded, loadUserPresets]);

  const customPresets = userPresets.map(userPresetToPreset);

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title="Choose a Preset"
      subtitle="// New Landing Page"
    >
      <div className="p-6 space-y-6">
        {customPresets.length > 0 && (
          <section>
            <div className="hud-label text-fg-muted mb-3">
              // Your Presets ({customPresets.length})
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {customPresets.map((preset, i) => {
                const rawId = userPresets[i].id;
                return (
                  <PresetCard
                    key={preset.id}
                    preset={preset}
                    onSelect={onSelect}
                    onDelete={() => void removeUserPreset(rawId)}
                  />
                );
              })}
            </div>
          </section>
        )}

        <section>
          <div className="hud-label text-fg-muted mb-3">// Built-in Presets</div>
          <p className="font-mono text-xs text-fg-muted mb-4 max-w-2xl">
            Each preset comes pre-loaded with the article from a real-world
            lander.  Click any text in the editor to edit; drop an image or
            video onto any media slot to replace it.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {PRESETS.map((preset) => (
              <PresetCard
                key={preset.id}
                preset={preset}
                onSelect={onSelect}
              />
            ))}
          </div>
        </section>
      </div>
    </Modal>
  );
}

interface PresetCardProps {
  preset: Preset;
  onSelect: (preset: Preset) => void;
  onDelete?: () => void;
}

function PresetCard({ preset, onSelect, onDelete }: PresetCardProps) {
  return (
    <div className="group/card relative">
      <button
        type="button"
        onClick={() => onSelect(preset)}
        className={cn(
          "group relative flex flex-col text-left w-full",
          "border border-border-hud hover:border-hud-cyan transition-colors",
          "bg-bg-elevated/30 hover:bg-bg-elevated/60",
          "hud-focus",
        )}
      >
        <div className="aspect-video relative overflow-hidden border-b border-border-hud bg-bg-base">
          {preset.thumbnail_src ? (
            <img
              src={preset.thumbnail_src}
              alt=""
              className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
              loading="lazy"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
              }}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-fg-dim">
              {preset.id === "blank" ? (
                <FileText className="w-8 h-8" strokeWidth={1.2} />
              ) : (
                <ImageOff className="w-8 h-8" strokeWidth={1.2} />
              )}
            </div>
          )}
          <div className="absolute top-2 left-2">
            {preset.is_user ? (
              <span className="px-2 py-0.5 font-mono text-[0.55rem] uppercase tracking-[0.15em] bg-bg-base/85 backdrop-blur-sm border text-hud-cyan border-hud-cyan/40">
                Custom
              </span>
            ) : (
              <span
                className={cn(
                  "px-2 py-0.5 font-mono text-[0.55rem] uppercase tracking-[0.15em] bg-bg-base/85 backdrop-blur-sm border",
                  FAMILY_COLOR[preset.family],
                )}
              >
                {FAMILY_LABEL[preset.family]}
              </span>
            )}
          </div>
        </div>

        <div className="p-4 flex flex-col gap-2 flex-1">
          <div className="font-mono text-sm uppercase tracking-[0.06em] text-fg group-hover:text-hud-cyan transition-colors">
            {preset.name}
          </div>
          {preset.description && (
            <p className="font-mono text-[0.7rem] leading-relaxed text-fg-muted flex-1">
              {preset.description}
            </p>
          )}
          {preset.source_url && (
            <div className="flex items-center justify-end mt-1">
              <span
                className="hud-label text-fg-dim truncate max-w-[80%]"
                title={preset.source_url}
              >
                {new URL(preset.source_url).hostname.replace(/^www\./, "")}
              </span>
            </div>
          )}
        </div>
      </button>

      {onDelete && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (confirm(`Delete preset "${preset.name}"?`)) onDelete();
          }}
          className="absolute top-2 right-2 p-1.5 bg-bg-base/80 backdrop-blur-sm border border-border-hud text-fg-muted hover:text-hud-red hover:border-hud-red transition-colors opacity-0 group-hover/card:opacity-100"
          title="Delete preset"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
