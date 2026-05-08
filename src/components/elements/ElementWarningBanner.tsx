import { AlertTriangle } from "lucide-react";

export function ElementWarningBanner() {
  return (
    <div className="relative border border-hud-amber/40 bg-hud-amber/5 px-4 py-3 flex gap-3">
      <AlertTriangle className="w-4 h-4 text-hud-amber flex-shrink-0 mt-0.5" />
      <div>
        <div className="hud-label text-hud-amber mb-1">Reference Restriction</div>
        <p className="font-mono text-[0.7rem] text-fg-muted leading-relaxed">
          BytePlus does not allow realistic human faces in reference images. Use
          stylized art, illustrations, or non-face references for character
          elements.
        </p>
      </div>
    </div>
  );
}
