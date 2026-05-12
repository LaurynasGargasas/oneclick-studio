// Floating formatting toolbar.  Appears when the user makes a
// non-collapsed selection inside the editable canvas, positioned above
// the selection.  Buttons apply standard inline formatting via
// document.execCommand (deprecated but universally supported in
// Chromium/WebKit) plus a custom font-size handler that wraps the
// selection in a <span style="font-size:...">.
//
// preventDefault on mousedown is what keeps the selection alive while
// the user clicks toolbar buttons — without it, the focus would jump
// to the button and the selection would collapse.

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Bold,
  Italic,
  Underline,
  Heading1,
  Heading2,
  Heading3,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Type as TypeIcon,
  Palette,
  Eraser,
  Link as LinkIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";

interface FormattingToolbarProps {
  /** Element that contains the editable content; toolbar only shows
   *  when the selection is inside this element. */
  canvas: HTMLElement | null;
  /** Called after any formatting mutation so the editor can save. */
  onChange: () => void;
}

interface ToolbarPosition {
  top: number;
  left: number;
}

const COLOR_PALETTE = [
  "#0f172a", "#475569", "#94a3b8", "#dc2626",
  "#ea580c", "#ca8a04", "#16a34a", "#0891b2",
  "#2563eb", "#7c3aed", "#db2777", "#ffffff",
];

const FONT_SIZES = [
  { label: "12", value: "12px" },
  { label: "14", value: "14px" },
  { label: "16", value: "16px" },
  { label: "18", value: "18px" },
  { label: "20", value: "20px" },
  { label: "24", value: "24px" },
  { label: "32", value: "32px" },
  { label: "40", value: "40px" },
  { label: "48", value: "48px" },
];

export function FormattingToolbar({ canvas, onChange }: FormattingToolbarProps) {
  const [pos, setPos] = useState<ToolbarPosition | null>(null);
  const [colorOpen, setColorOpen] = useState(false);
  const [sizeOpen, setSizeOpen] = useState(false);
  const toolbarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!canvas) return;

    function update() {
      const selection = window.getSelection();
      if (
        !selection ||
        selection.rangeCount === 0 ||
        selection.isCollapsed ||
        !canvas ||
        !canvas.contains(selection.anchorNode) ||
        !canvas.contains(selection.focusNode)
      ) {
        setPos(null);
        return;
      }
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) {
        setPos(null);
        return;
      }
      const tb = toolbarRef.current;
      const tbW = tb?.offsetWidth ?? 360;
      const tbH = tb?.offsetHeight ?? 40;
      const margin = 8;
      let top = rect.top + window.scrollY - tbH - margin;
      let left = rect.left + window.scrollX + rect.width / 2 - tbW / 2;
      // Flip below the selection if there's no room above.
      if (top < margin) top = rect.bottom + window.scrollY + margin;
      // Clamp horizontally.
      const maxLeft = window.scrollX + window.innerWidth - tbW - margin;
      const minLeft = window.scrollX + margin;
      if (left > maxLeft) left = maxLeft;
      if (left < minLeft) left = minLeft;
      setPos({ top, left });
    }

    document.addEventListener("selectionchange", update);
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      document.removeEventListener("selectionchange", update);
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [canvas]);

  function exec(command: string, value?: string) {
    document.execCommand(command, false, value);
    onChange();
  }

  function applyHeading(tag: "H1" | "H2" | "H3" | "P") {
    exec("formatBlock", `<${tag.toLowerCase()}>`);
  }

  function applyColor(color: string) {
    exec("foreColor", color);
    setColorOpen(false);
  }

  // Custom font-size: wrap the selection in a span with inline
  // font-size.  execCommand("fontSize") only takes 1-7 numeric values
  // and emits <font> tags, which is far worse than a clean span style.
  function applyFontSize(value: string) {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
    const range = sel.getRangeAt(0);
    const span = document.createElement("span");
    span.style.fontSize = value;
    try {
      span.appendChild(range.extractContents());
      range.insertNode(span);
      // Re-select the wrapped content so successive clicks chain.
      const newRange = document.createRange();
      newRange.selectNodeContents(span);
      sel.removeAllRanges();
      sel.addRange(newRange);
      onChange();
    } catch {
      // Selection spans non-contiguous nodes — fall back silently.
    }
    setSizeOpen(false);
  }

  function applyLink() {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
    const existing = (sel.anchorNode?.parentElement?.closest("a") as
      | HTMLAnchorElement
      | null)?.href ?? "";
    const href = window.prompt("Link URL", existing || "https://");
    if (href === null) return;
    if (href === "") {
      exec("unlink");
    } else {
      exec("createLink", href);
    }
  }

  if (!pos || !canvas) return null;

  return createPortal(
    <div
      ref={toolbarRef}
      className="flex items-stretch gap-0.5 p-1 bg-bg-panel border border-border-strong shadow-2xl rounded"
      style={{
        position: "absolute",
        top: pos.top,
        left: pos.left,
        zIndex: 60,
        whiteSpace: "nowrap",
      }}
      // Critical: prevent the toolbar from stealing focus so the
      // selection survives across button clicks.
      onMouseDown={(e) => e.preventDefault()}
    >
      <ToolbarButton title="Bold" onClick={() => exec("bold")}>
        <Bold className="w-3.5 h-3.5" />
      </ToolbarButton>
      <ToolbarButton title="Italic" onClick={() => exec("italic")}>
        <Italic className="w-3.5 h-3.5" />
      </ToolbarButton>
      <ToolbarButton title="Underline" onClick={() => exec("underline")}>
        <Underline className="w-3.5 h-3.5" />
      </ToolbarButton>

      <Divider />

      <ToolbarButton title="Heading 1" onClick={() => applyHeading("H1")}>
        <Heading1 className="w-3.5 h-3.5" />
      </ToolbarButton>
      <ToolbarButton title="Heading 2" onClick={() => applyHeading("H2")}>
        <Heading2 className="w-3.5 h-3.5" />
      </ToolbarButton>
      <ToolbarButton title="Heading 3" onClick={() => applyHeading("H3")}>
        <Heading3 className="w-3.5 h-3.5" />
      </ToolbarButton>
      <ToolbarButton title="Paragraph" onClick={() => applyHeading("P")}>
        <span className="text-[0.65rem] font-mono">P</span>
      </ToolbarButton>

      <Divider />

      {/* Font size */}
      <div className="relative">
        <ToolbarButton
          title="Font size"
          onClick={() => setSizeOpen((o) => !o)}
          active={sizeOpen}
        >
          <TypeIcon className="w-3.5 h-3.5" />
        </ToolbarButton>
        {sizeOpen && (
          <div className="absolute top-full left-0 mt-1 bg-bg-panel border border-border-strong shadow-2xl rounded min-w-[80px]">
            {FONT_SIZES.map((s) => (
              <button
                key={s.value}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => applyFontSize(s.value)}
                className="block w-full text-left px-3 py-1.5 font-mono text-xs text-fg hover:bg-hud-cyan/10 hover:text-hud-cyan"
              >
                {s.label}px
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Color */}
      <div className="relative">
        <ToolbarButton
          title="Text color"
          onClick={() => setColorOpen((o) => !o)}
          active={colorOpen}
        >
          <Palette className="w-3.5 h-3.5" />
        </ToolbarButton>
        {colorOpen && (
          <div className="absolute top-full left-0 mt-1 p-1.5 bg-bg-panel border border-border-strong shadow-2xl rounded grid grid-cols-6 gap-1 w-[148px]">
            {COLOR_PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => applyColor(c)}
                title={c}
                className="w-5 h-5 border border-border-hud hover:border-hud-cyan transition-colors"
                style={{ background: c }}
              />
            ))}
          </div>
        )}
      </div>

      <Divider />

      <ToolbarButton title="Align left" onClick={() => exec("justifyLeft")}>
        <AlignLeft className="w-3.5 h-3.5" />
      </ToolbarButton>
      <ToolbarButton title="Align center" onClick={() => exec("justifyCenter")}>
        <AlignCenter className="w-3.5 h-3.5" />
      </ToolbarButton>
      <ToolbarButton title="Align right" onClick={() => exec("justifyRight")}>
        <AlignRight className="w-3.5 h-3.5" />
      </ToolbarButton>

      <Divider />

      <ToolbarButton title="Add link" onClick={applyLink}>
        <LinkIcon className="w-3.5 h-3.5" />
      </ToolbarButton>
      <ToolbarButton
        title="Clear formatting"
        onClick={() => exec("removeFormat")}
      >
        <Eraser className="w-3.5 h-3.5" />
      </ToolbarButton>
    </div>,
    document.body,
  );
}

function ToolbarButton({
  title,
  onClick,
  active,
  children,
}: {
  title: string;
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      onMouseDown={(e) => e.preventDefault()}
      className={cn(
        "flex items-center justify-center px-2 h-7 text-fg-muted hover:text-hud-cyan hover:bg-hud-cyan/[0.08] transition-colors rounded-sm",
        active && "bg-hud-cyan/15 text-hud-cyan",
      )}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span className="w-px self-stretch bg-border-hud mx-0.5" />;
}
