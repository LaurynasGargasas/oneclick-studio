// Save the current landing as a user preset so it appears in the
// PresetPicker alongside the built-ins.

import { useEffect, useState } from "react";
import { Modal, Button, HudInput, HudTextarea } from "@/components/hud";
import { useUserPresets } from "@/stores/userPresetsStore";
import { toast } from "@/stores/toastStore";
import type { CssFamily } from "@/lib/landingTypes";

interface SaveAsPresetModalProps {
  open: boolean;
  onClose: () => void;
  defaultName: string;
  html: string;
  cssFamily: CssFamily;
}

function extractFirstImage(html: string): string | undefined {
  const m = html.match(/<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/i);
  if (!m) return undefined;
  const src = m[1];
  return src.startsWith("//") ? `https:${src}` : src;
}

export function SaveAsPresetModal({
  open,
  onClose,
  defaultName,
  html,
  cssFamily,
}: SaveAsPresetModalProps) {
  const create = useUserPresets((s) => s.create);
  const [name, setName] = useState(defaultName);
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(defaultName);
      setDescription("");
    }
  }, [open, defaultName]);

  async function handleSave() {
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      await create({
        name: name.trim(),
        description: description.trim() || null,
        css_family: cssFamily,
        html,
        thumbnail_src: extractFirstImage(html) ?? null,
      });
      toast.success("Preset saved", name.trim());
      onClose();
    } catch (e) {
      toast.error("Save failed", String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title="Save as Preset"
      subtitle="// New User Preset"
    >
      <div className="p-6 space-y-5">
        <p className="font-mono text-xs text-fg-muted">
          Your current landing (HTML + styling family) will be saved as a
          reusable preset.  It'll appear in the preset picker for new landing
          pages.
        </p>
        <div>
          <div className="hud-label text-fg-dim mb-2">Name</div>
          <HudInput
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. My Custom Advertorial"
            maxLength={120}
          />
        </div>
        <div>
          <div className="hud-label text-fg-dim mb-2">Description (optional)</div>
          <HudTextarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Short description shown in the picker"
            rows={3}
            maxLength={500}
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSave}
            disabled={saving || !name.trim()}
          >
            {saving ? "Saving..." : "Save Preset"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
