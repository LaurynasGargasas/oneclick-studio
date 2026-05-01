import { useEffect, useState, type ChangeEvent } from "react";
import { Save, Trash2, Plus, Image as ImageIcon } from "lucide-react";
import {
  Modal,
  Button,
  HudInput,
  HudTextarea,
  Select,
} from "@/components/hud";
import {
  ELEMENT_TYPES,
  ELEMENT_TYPE_META,
  type ElementType,
} from "@/lib/elementTypes";
import { useElements, type Element } from "@/stores/elementsStore";
import { assetUrl } from "@/lib/assetUrl";
import { slugifyTag } from "@/lib/validators";

interface Props {
  element: Element | null;
  onClose: () => void;
}

const MAX_IMAGES = 9;

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function ElementDetailModal({ element, onClose }: Props) {
  const update = useElements((s) => s.update);
  const remove = useElements((s) => s.remove);
  const appendImage = useElements((s) => s.appendImage);
  const removeImage = useElements((s) => s.removeImage);
  const items = useElements((s) => s.items);

  const [tag, setTag] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [type, setType] = useState<ElementType>("character");
  const [description, setDescription] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const live = element ? items.find((e) => e.id === element.id) || element : null;

  useEffect(() => {
    if (element) {
      setTag(element.tag);
      setDisplayName(element.display_name);
      setType(element.type);
      setDescription(element.description || "");
      setConfirmDelete(false);
    }
  }, [element]);

  if (!live) return null;

  const dirty =
    tag !== live.tag ||
    displayName !== live.display_name ||
    type !== live.type ||
    (description || "") !== (live.description || "");

  const tagConflict =
    tag !== live.tag && items.some((e) => e.tag === tag && e.id !== live.id);

  async function handleSave() {
    if (!live || !dirty || tagConflict) return;
    setSaving(true);
    try {
      await update(live.id, {
        tag,
        display_name: displayName,
        type,
        description: description || null,
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!live) return;
    await remove(live.id);
    onClose();
  }

  async function handleFileInput(e: ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || !live) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const currentCount = (
          useElements.getState().items.find((el) => el.id === live.id)?.images
            .length ?? 0
        );
        if (currentCount >= MAX_IMAGES) break;
        const dataUrl = await readAsDataUrl(file);
        await appendImage(live.id, {
          data_url: dataUrl,
          original_name: file.name,
        });
      }
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  return (
    <Modal
      open={!!element}
      onClose={onClose}
      title={live.display_name}
      subtitle={`@${live.tag}`}
      size="xl"
    >
      <div className="grid grid-cols-12 gap-6 p-6">
        {/* Images */}
        <div className="col-span-7 space-y-3">
          <div className="flex items-baseline justify-between">
            <span className="hud-label text-fg-muted">Reference Images</span>
            <span className="font-mono text-[0.65rem] text-fg-dim">
              {live.images.length}/{MAX_IMAGES}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {live.images.map((img) => (
              <div
                key={img.id}
                className="relative aspect-square border border-border-hud bg-bg-elevated overflow-hidden group"
              >
                <img
                  src={assetUrl(img.file_path)}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => removeImage(live.id, img.id)}
                  className="absolute top-1 right-1 w-6 h-6 bg-bg-base/80 border border-hud-red text-hud-red flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label="Delete image"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}

            {live.images.length < MAX_IMAGES && (
              <label className="aspect-square border border-dashed border-border-hud bg-bg-elevated/40 hover:bg-hud-cyan/5 hover:border-hud-cyan/60 transition-colors flex flex-col items-center justify-center gap-1 cursor-pointer">
                {uploading ? (
                  <span className="font-mono text-[0.6rem] text-hud-cyan hud-pulse">
                    Uploading...
                  </span>
                ) : (
                  <>
                    <Plus
                      className="w-5 h-5 text-fg-muted"
                      strokeWidth={1.2}
                    />
                    <span className="font-mono text-[0.55rem] uppercase text-fg-dim">
                      Add
                    </span>
                  </>
                )}
                <input
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFileInput}
                  disabled={uploading}
                  className="hidden"
                />
              </label>
            )}
          </div>

          {live.images.length === 0 && (
            <div className="border border-border-hud bg-bg-elevated/40 p-8 flex flex-col items-center gap-2 text-center">
              <ImageIcon className="w-8 h-8 text-fg-dim" />
              <div className="font-mono text-xs uppercase text-fg">No images</div>
              <div className="font-mono text-[0.65rem] text-fg-dim">
                Use the Add tile above to upload references.
              </div>
            </div>
          )}
        </div>

        {/* Metadata */}
        <div className="col-span-5 space-y-4">
          <HudInput
            label="Display Name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
          <HudInput
            label="Tag"
            mono
            value={tag}
            onChange={(e) => setTag(slugifyTag(e.target.value))}
            error={tagConflict ? "Tag already in use" : undefined}
          />
          <Select
            label="Type"
            value={type}
            onChange={(v) => setType(v as ElementType)}
            options={ELEMENT_TYPES.map((t) => ({
              value: t,
              label: ELEMENT_TYPE_META[t].label,
              color: ELEMENT_TYPE_META[t].color,
            }))}
          />
          <HudTextarea
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          <div className="pt-3 border-t border-border-hud space-y-3">
            <div className="hud-label text-fg-dim">Stats</div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <div className="hud-label text-fg-dim">Created</div>
                <div className="font-mono text-fg">
                  {new Date(live.created_at).toLocaleDateString()}
                </div>
              </div>
              <div>
                <div className="hud-label text-fg-dim">Updated</div>
                <div className="font-mono text-fg">
                  {new Date(live.updated_at).toLocaleDateString()}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-shrink-0 flex items-center justify-between gap-3 px-6 py-4 border-t border-border-hud bg-bg-base/40">
        {confirmDelete ? (
          <div className="flex items-center gap-3">
            <span className="hud-label text-hud-red">
              Delete this element and all its images?
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmDelete(false)}
            >
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={handleDelete}>
              Confirm Delete
            </Button>
          </div>
        ) : (
          <Button
            variant="danger"
            size="sm"
            iconLeft={<Trash2 className="w-3.5 h-3.5" />}
            onClick={() => setConfirmDelete(true)}
          >
            Delete Element
          </Button>
        )}

        <div className="flex gap-3">
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button
            variant="primary"
            disabled={!dirty || tagConflict || saving}
            loading={saving}
            iconLeft={<Save className="w-4 h-4" />}
            onClick={handleSave}
          >
            Save Changes
          </Button>
        </div>
      </div>
    </Modal>
  );
}
