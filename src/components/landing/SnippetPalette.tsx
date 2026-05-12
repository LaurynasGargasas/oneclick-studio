// Floating "+" launcher on the landing-page editor.  Opens a popover
// listing snippet blocks (headline, image+text, CTA, etc.) that get
// inserted at the current cursor position when clicked.
//
// Rendered via createPortal under document.body so the framer-motion
// route transition's `transform` doesn't create a containing block
// for our `position: fixed` element (which would otherwise make the
// button scroll with the editor content).

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { SNIPPETS, type Snippet } from "./landingSnippets";

interface SnippetPaletteProps {
  onPick: (snippet: Snippet) => void;
}

const CATEGORIES: Snippet["category"][] = [
  "Text",
  "Media",
  "Lists",
  "CTA",
  "Layout",
  "Social Proof",
];

export function SnippetPalette({ onPick }: SnippetPaletteProps) {
  const [open, setOpen] = useState(false);
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

  function handlePick(s: Snippet) {
    onPick(s);
    setOpen(false);
  }

  return createPortal(
    <div
      className="fixed bottom-6 right-6 z-[1000]"
      ref={ref}
      style={{ position: "fixed" }}
    >
      {open && (
        <div className="absolute bottom-14 right-0 w-[320px] max-h-[60vh] overflow-y-auto bg-bg-panel border border-border-strong shadow-2xl">
          <div className="sticky top-0 z-10 flex items-center justify-between px-3 py-2 bg-bg-panel border-b border-border-hud">
            <span className="hud-label text-fg-muted">// Insert Block</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-fg-muted hover:text-hud-cyan"
              aria-label="Close"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          {CATEGORIES.map((cat) => {
            const items = SNIPPETS.filter((s) => s.category === cat);
            if (items.length === 0) return null;
            return (
              <div key={cat} className="border-b border-border-hud/40 last:border-0">
                <div className="px-3 py-1.5 hud-label text-fg-dim">{cat}</div>
                <div className="px-1 pb-1">
                  {items.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => handlePick(s)}
                      className="block w-full text-left px-2 py-1.5 font-mono text-xs uppercase tracking-[0.05em] text-fg-muted hover:text-hud-cyan hover:bg-hud-cyan/[0.05] transition-colors"
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "w-12 h-12 rounded-full flex items-center justify-center",
          "bg-hud-cyan text-bg-base shadow-[0_4px_16px_rgba(0,240,255,0.4)]",
          "hover:scale-105 transition-transform",
          open && "rotate-45",
        )}
        title="Insert block"
        aria-label="Insert block"
      >
        <Plus className="w-6 h-6" strokeWidth={2} />
      </button>
    </div>,
    document.body,
  );
}
