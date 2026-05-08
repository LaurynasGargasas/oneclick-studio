// Full-size image viewer with Save / Copy actions for a generated character.

import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { save as saveDialog } from "@tauri-apps/plugin-dialog";
import { writeImage } from "@tauri-apps/plugin-clipboard-manager";
import { Download, Copy, Check } from "lucide-react";
import { Modal, Button } from "@/components/hud";
import { toast } from "@/stores/toastStore";

interface Props {
  open: boolean;
  onClose: () => void;
  imageUrl: string | null;
  filenameHint?: string;
}

export function CharacterImageModal({ open, onClose, imageUrl, filenameHint }: Props) {
  const [saving, setSaving] = useState(false);
  const [copying, setCopying] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleSave() {
    if (!imageUrl) return;
    setSaving(true);
    try {
      const defaultName =
        (filenameHint ? filenameHint.replace(/[^a-z0-9_-]/gi, "_") : "character") +
        ".png";
      const path = await saveDialog({
        defaultPath: defaultName,
        filters: [{ name: "Image", extensions: ["png", "jpg", "webp"] }],
      });
      if (!path) return;
      await invoke<string>("download_image_to_path", {
        url: imageUrl,
        destPath: path,
      });
      toast.success("Saved", path);
    } catch (e) {
      toast.error("Save failed", String(e));
    } finally {
      setSaving(false);
    }
  }

  async function handleCopy() {
    if (!imageUrl) return;
    setCopying(true);
    try {
      const bytes = await invoke<number[]>("fetch_image_bytes", { url: imageUrl });
      // Tauri's clipboard plugin accepts a Uint8Array of image bytes (any format
      // it can decode — PNG/JPEG/WEBP); it converts to the clipboard's native
      // image format internally.
      await writeImage(new Uint8Array(bytes));
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 1500);
    } catch (e) {
      toast.error("Copy failed", String(e));
    } finally {
      setCopying(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Character" size="lg">
      <div className="p-5 flex flex-col gap-4">
        <div className="bg-black/40 border border-border-hud aspect-[3/4] flex items-center justify-center overflow-hidden">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt="Generated character"
              className="max-w-full max-h-full object-contain"
            />
          ) : (
            <span className="font-mono text-xs text-fg-dim">No image</span>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="primary"
            iconLeft={<Download className="w-3.5 h-3.5" />}
            loading={saving}
            disabled={!imageUrl}
            onClick={() => void handleSave()}
          >
            Save Image
          </Button>
          <Button
            variant="secondary"
            iconLeft={
              copied ? (
                <Check className="w-3.5 h-3.5" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )
            }
            loading={copying}
            disabled={!imageUrl}
            onClick={() => void handleCopy()}
          >
            {copied ? "Copied" : "Copy Image"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
