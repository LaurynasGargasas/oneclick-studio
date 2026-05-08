// UGC Character Creator — pick options on the left, get 4 photoreal portraits
// from Higgsfield Soul 2.0 on the right.

import { useEffect, useMemo, useState } from "react";
import { Sparkles, Pencil, Lock, Loader2, AlertTriangle } from "lucide-react";
import { Panel, Button, HudTextarea, Slider } from "@/components/hud";
import { OptionChips } from "@/components/character/OptionChips";
import { CharacterImageModal } from "@/components/character/CharacterImageModal";
import {
  GROUPS,
  EMPTY_SELECTIONS,
  buildPrompt,
  hasMinimumSelection,
  type CharacterSelections,
  type SingleSelectGroup,
  type MultiSelectGroup,
} from "@/lib/characterPrompt";
import { useCharacters, type CharacterImage } from "@/stores/charactersStore";
import { useSettings } from "@/stores/settingsStore";
import { toast } from "@/stores/toastStore";
import { cn } from "@/lib/cn";

const SINGLE_GROUPS: SingleSelectGroup[] = GROUPS.filter(
  (g): g is SingleSelectGroup => g.kind === "single",
);
const MULTI_GROUPS: MultiSelectGroup[] = GROUPS.filter(
  (g): g is MultiSelectGroup => g.kind === "multi",
);

// Map group → which selection field it writes to.
type SingleField =
  | "gender"
  | "ethnicity"
  | "bodyType"
  | "hairColor"
  | "hairStyle"
  | "facialHair"
  | "clothes"
  | "profession";

const GROUP_TO_FIELD: Record<string, SingleField> = {
  gender: "gender",
  ethnicity: "ethnicity",
  bodyType: "bodyType",
  hairColor: "hairColor",
  hairStyle: "hairStyle",
  facialHair: "facialHair",
  clothes: "clothes",
  profession: "profession",
};

export function CharacterCreator() {
  const settings = useSettings();
  const characters = useCharacters();

  const [selections, setSelections] = useState<CharacterSelections>(EMPTY_SELECTIONS);
  const [ageEnabled, setAgeEnabled] = useState(false);
  const [age, setAge] = useState(28);
  const [editingPrompt, setEditingPrompt] = useState(false);
  const [editedPrompt, setEditedPrompt] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [modalImg, setModalImg] = useState<CharacterImage | null>(null);

  // Auto-load history on mount
  useEffect(() => {
    void characters.load();
    return () => {
      characters.cancelPolling();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Derive prompt from selections + (maybe) age
  const liveSelections: CharacterSelections = useMemo(
    () => ({ ...selections, age: ageEnabled ? age : undefined }),
    [selections, ageEnabled, age],
  );
  const derivedPrompt = useMemo(() => buildPrompt(liveSelections), [liveSelections]);
  const activePrompt = editingPrompt ? editedPrompt : derivedPrompt;

  function updateSingle(field: SingleField, value: string | undefined) {
    setSelections((s) => ({ ...s, [field]: value }));
  }
  function updateMulti(value: string[]) {
    setSelections((s) => ({ ...s, accessories: value }));
  }
  function updateOther(field: "clothesOther" | "professionOther", value: string) {
    setSelections((s) => ({ ...s, [field]: value }));
  }
  function clearAll() {
    setSelections(EMPTY_SELECTIONS);
    setAgeEnabled(false);
    setAge(28);
    setEditingPrompt(false);
    setEditedPrompt("");
  }

  const credentialsOk =
    settings.higgsfieldApiKey.trim().length > 0 &&
    settings.higgsfieldApiSecret.trim().length > 0;

  const isPolling = characters.pollingBatchId !== null;
  const canGenerate =
    credentialsOk &&
    !isPolling &&
    (editingPrompt
      ? editedPrompt.trim().length > 0
      : hasMinimumSelection(liveSelections));

  async function handleGenerate() {
    if (!credentialsOk) {
      toast.error(
        "Higgsfield credentials missing",
        "Add API key + secret in Settings.",
      );
      return;
    }
    try {
      await characters.submit({
        prompt: activePrompt,
        selections: liveSelections,
        api_key: settings.higgsfieldApiKey,
        api_secret: settings.higgsfieldApiSecret,
        size: "1536x2048", // portrait
        quality: "1080p",
      });
    } catch {
      // toast already shown by store
    }
  }

  function openImage(img: CharacterImage) {
    if (img.status !== "completed" || !img.image_url) return;
    setModalImg(img);
    setModalOpen(true);
  }

  return (
    <div className="grid grid-cols-12 gap-5">
      {/* Header */}
      <div className="col-span-12 flex items-center justify-between">
        <div>
          <p className="hud-label text-fg-dim">// Character Creator</p>
          <h1 className="font-mono text-2xl uppercase tracking-[0.1em] text-fg hud-text-glow-cyan">
            UGC Character Creator
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={clearAll} disabled={isPolling}>
            Clear
          </Button>
          <Button
            variant="primary"
            iconLeft={<Sparkles className="w-3.5 h-3.5" />}
            loading={isPolling}
            disabled={!canGenerate}
            onClick={() => void handleGenerate()}
          >
            {isPolling ? "Generating…" : "Generate 4 Images"}
          </Button>
        </div>
      </div>

      {/* Credentials warning */}
      {!credentialsOk && (
        <div className="col-span-12">
          <div className="border border-hud-amber/40 bg-hud-amber/5 px-4 py-3 flex gap-3 items-start">
            <AlertTriangle className="w-4 h-4 text-hud-amber flex-shrink-0 mt-0.5" />
            <div>
              <div className="hud-label text-hud-amber mb-1">
                Higgsfield credentials required
              </div>
              <p className="font-mono text-[0.7rem] text-fg-muted leading-relaxed">
                Add your Higgsfield API key and secret in Settings → Higgsfield
                to generate characters.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* LEFT — option panels */}
      <div className="col-span-12 lg:col-span-7 flex flex-col gap-4">
        <Panel className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="hud-label text-fg">Identity</h2>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-5">
            {SINGLE_GROUPS.filter((g) =>
              ["gender", "ethnicity", "bodyType", "hairColor"].includes(g.group),
            ).map((g) => (
              <OptionChips
                key={g.group}
                kind="single"
                label={g.label}
                options={g.options}
                value={selections[GROUP_TO_FIELD[g.group]] as string | undefined}
                onChange={(v) => updateSingle(GROUP_TO_FIELD[g.group], v)}
              />
            ))}

            {/* Age */}
            <div className="col-span-2">
              <div className="flex items-center justify-between mb-2">
                <span className="hud-label text-fg-dim">Age</span>
                <button
                  type="button"
                  onClick={() => setAgeEnabled((x) => !x)}
                  className={cn(
                    "font-mono text-[0.6rem] uppercase tracking-[0.1em] px-2 py-1",
                    "border transition-colors hud-focus",
                    ageEnabled
                      ? "bg-hud-cyan/15 border-hud-cyan text-hud-cyan"
                      : "border-border-hud text-fg-muted hover:text-fg",
                  )}
                >
                  {ageEnabled ? `Specified · ${age}` : "Not specified"}
                </button>
              </div>
              {ageEnabled && (
                <Slider
                  value={age}
                  onChange={setAge}
                  min={1}
                  max={100}
                  step={1}
                  ticks={[10, 25, 50, 75, 100]}
                />
              )}
            </div>
          </div>
        </Panel>

        <Panel className="p-5">
          <h2 className="hud-label text-fg mb-4">Appearance</h2>
          <div className="grid grid-cols-2 gap-x-6 gap-y-5">
            {SINGLE_GROUPS.filter((g) =>
              ["hairStyle", "facialHair"].includes(g.group),
            ).map((g) => (
              <OptionChips
                key={g.group}
                kind="single"
                label={g.label}
                options={g.options}
                value={selections[GROUP_TO_FIELD[g.group]] as string | undefined}
                onChange={(v) => updateSingle(GROUP_TO_FIELD[g.group], v)}
              />
            ))}
            {MULTI_GROUPS.map((g) => (
              <OptionChips
                key={g.group}
                kind="multi"
                label={g.label}
                options={g.options}
                value={selections.accessories}
                onChange={updateMulti}
              />
            ))}
          </div>
        </Panel>

        <Panel className="p-5">
          <h2 className="hud-label text-fg mb-4">Wardrobe & Role</h2>
          <div className="grid grid-cols-2 gap-x-6 gap-y-5">
            {SINGLE_GROUPS.filter((g) =>
              ["clothes", "profession"].includes(g.group),
            ).map((g) => {
              const field = GROUP_TO_FIELD[g.group];
              const otherField =
                g.group === "clothes" ? "clothesOther" : "professionOther";
              return (
                <OptionChips
                  key={g.group}
                  kind="single"
                  label={g.label}
                  options={g.options}
                  value={selections[field] as string | undefined}
                  onChange={(v) => updateSingle(field, v)}
                  allowOther={g.allowOther}
                  otherValue={selections[otherField]}
                  onOtherChange={(v) => updateOther(otherField, v)}
                />
              );
            })}
          </div>
        </Panel>
      </div>

      {/* RIGHT — prompt preview + 4-image grid */}
      <div className="col-span-12 lg:col-span-5 flex flex-col gap-4">
        <Panel className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="hud-label text-fg">Prompt</h2>
            <button
              type="button"
              onClick={() => {
                if (editingPrompt) {
                  setEditingPrompt(false);
                } else {
                  setEditedPrompt(derivedPrompt);
                  setEditingPrompt(true);
                }
              }}
              className={cn(
                "flex items-center gap-1.5 font-mono text-[0.6rem] uppercase",
                "tracking-[0.1em] px-2 py-1 border transition-colors hud-focus",
                editingPrompt
                  ? "bg-hud-amber/15 border-hud-amber text-hud-amber"
                  : "border-border-hud text-fg-muted hover:text-fg",
              )}
            >
              {editingPrompt ? (
                <>
                  <Lock className="w-3 h-3" />
                  Lock to Selections
                </>
              ) : (
                <>
                  <Pencil className="w-3 h-3" />
                  Edit Manually
                </>
              )}
            </button>
          </div>
          {editingPrompt ? (
            <HudTextarea
              value={editedPrompt}
              onChange={(e) => setEditedPrompt(e.target.value)}
              rows={6}
              placeholder="Describe the character…"
            />
          ) : (
            <div
              className={cn(
                "min-h-[6rem] px-3 py-2.5 border border-border-hud bg-bg-elevated/30",
                "font-mono text-[0.75rem] text-fg leading-relaxed whitespace-pre-wrap",
              )}
            >
              {derivedPrompt || (
                <span className="text-fg-dim">
                  Pick at least a gender to start building a prompt.
                </span>
              )}
            </div>
          )}
        </Panel>

        <Panel className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="hud-label text-fg">Output</h2>
            {isPolling && (
              <span className="flex items-center gap-1.5 font-mono text-[0.6rem] uppercase tracking-[0.1em] text-hud-amber">
                <Loader2 className="w-3 h-3 animate-spin" />
                Polling Higgsfield…
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {(characters.images.length > 0
              ? characters.images
              : Array.from({ length: 4 }).map(() => null)
            ).map((img, i) => (
              <ImageTile
                key={img?.id ?? `empty-${i}`}
                img={img}
                onClick={() => img && openImage(img)}
              />
            ))}
          </div>
        </Panel>
      </div>

      <CharacterImageModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        imageUrl={modalImg?.image_url ?? null}
        filenameHint={`character-${modalImg?.id?.slice(0, 8) ?? "image"}`}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// One tile in the 2x2 grid
// ---------------------------------------------------------------------------

function ImageTile({
  img,
  onClick,
}: {
  img: CharacterImage | null;
  onClick: () => void;
}) {
  if (!img) {
    return (
      <div className="aspect-[3/4] border border-border-hud bg-bg-elevated/20 flex items-center justify-center">
        <span className="font-mono text-[0.6rem] text-fg-dim uppercase tracking-[0.1em]">
          Empty
        </span>
      </div>
    );
  }
  if (img.status === "completed" && img.image_url) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="group relative aspect-[3/4] border border-border-hud overflow-hidden hud-focus"
      >
        <img
          src={img.image_url}
          alt="Character"
          className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
        />
        <div className="absolute inset-0 bg-hud-cyan/0 group-hover:bg-hud-cyan/10 transition-colors" />
      </button>
    );
  }
  if (img.status === "failed" || img.status === "nsfw" || img.status === "canceled") {
    return (
      <div className="aspect-[3/4] border border-hud-red/40 bg-hud-red/5 flex flex-col items-center justify-center gap-1 p-2">
        <AlertTriangle className="w-4 h-4 text-hud-red" />
        <span className="font-mono text-[0.6rem] text-hud-red uppercase tracking-[0.1em]">
          {img.status}
        </span>
      </div>
    );
  }
  // queued / in_progress — animated placeholder
  return (
    <div className="aspect-[3/4] border border-border-hud bg-bg-elevated/30 flex flex-col items-center justify-center gap-2 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-hud-cyan/0 via-hud-cyan/5 to-hud-cyan/0 animate-pulse" />
      <Loader2 className="w-5 h-5 text-hud-cyan animate-spin" />
      <span className="font-mono text-[0.6rem] text-fg-dim uppercase tracking-[0.1em]">
        {img.status === "queued" ? "Queued" : "Rendering"}
      </span>
    </div>
  );
}
