import { useEffect, useRef, useState } from "react";
import { Download, ChevronDown, Copy, Check, FileCode2 } from "lucide-react";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { save as saveDialog } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import type { LandingDocument } from "@/lib/landingTypes";
import { renderLandingHtml } from "@/lib/landingExport";
import { toast } from "@/stores/toastStore";
import { cn } from "@/lib/cn";

interface ExportMenuProps {
  doc: LandingDocument;
  fileSlug: string;          // suggested file name, e.g. "longevity-secret"
  pageTitle?: string;        // default <title> in exported HTML
}

export function ExportMenu({ doc, fileSlug, pageTitle }: ExportMenuProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function copyToClipboard() {
    try {
      const html = await renderLandingHtml(doc, { title: pageTitle });
      await writeText(html);
      setCopied(true);
      toast.success("HTML copied to clipboard");
      setTimeout(() => setCopied(false), 1800);
    } catch (e) {
      toast.error("Copy failed", String(e));
    }
    setOpen(false);
  }

  async function downloadHtml() {
    try {
      const path = await saveDialog({
        defaultPath: `${fileSlug || "landing-page"}.html`,
        filters: [{ name: "HTML", extensions: ["html"] }],
      });
      if (!path) {
        setOpen(false);
        return;
      }
      const html = await renderLandingHtml(doc, { title: pageTitle });
      await writeTextFile(path, html);
      toast.success("Saved", path);
    } catch (e) {
      toast.error("Save failed", String(e));
    }
    setOpen(false);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "inline-flex items-center gap-2 px-3 py-1.5",
          "border border-hud-cyan/60 text-hud-cyan hover:bg-hud-cyan/[0.08] transition-colors",
          "font-mono text-[0.7rem] uppercase tracking-[0.15em]",
        )}
      >
        <Download className="w-3.5 h-3.5" />
        Export
        <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-30 w-[220px] bg-bg-panel border border-border-strong shadow-2xl">
          <button
            type="button"
            onClick={downloadHtml}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-hud-cyan/[0.05] hover:text-hud-cyan transition-colors"
          >
            <FileCode2 className="w-3.5 h-3.5" />
            <div className="flex-1">
              <div className="font-mono text-xs uppercase tracking-[0.06em] text-fg">
                Download HTML
              </div>
              <div className="font-mono text-[0.6rem] text-fg-dim">
                Standalone .html file
              </div>
            </div>
          </button>
          <div className="border-t border-border-hud/40" />
          <button
            type="button"
            onClick={copyToClipboard}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-hud-cyan/[0.05] hover:text-hud-cyan transition-colors"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-hud-green" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            <div className="flex-1">
              <div className="font-mono text-xs uppercase tracking-[0.06em] text-fg">
                {copied ? "Copied!" : "Copy HTML"}
              </div>
              <div className="font-mono text-[0.6rem] text-fg-dim">
                Paste into a Shopify page
              </div>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}
