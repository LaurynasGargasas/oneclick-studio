// Drag-to-reorder for top-level "sections" inside the landing canvas.
//
// A "section" is any direct Element child of the canvas root.  We tag
// each one with `data-lp-section`, give it `position: relative`, and
// inject a drag handle (also tagged `data-lp-editor-only`).  On
// dragstart we record the source, on dragover we show a drop indicator
// line (also editor-only), on drop we reposition the source and call
// `onChange()` so the editor saves.
//
// The serialize helper strips every editor-only node before innerHTML
// is written back to the document.

interface ReorderOptions {
  onChange: () => void;
}

const HANDLE_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
     fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="9" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="18" r="1"/>
  <circle cx="15" cy="6" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="18" r="1"/>
</svg>`;

function makeHandle(): HTMLDivElement {
  const handle = document.createElement("div");
  handle.setAttribute("data-lp-editor-only", "true");
  handle.setAttribute("contenteditable", "false");
  handle.setAttribute("draggable", "true");
  handle.setAttribute("title", "Drag to reorder section");
  handle.setAttribute("aria-label", "Drag to reorder section");
  handle.style.cssText = [
    "position: absolute",
    "top: 8px",
    "right: 8px",
    "z-index: 50",
    "width: 32px",
    "height: 28px",
    "display: none",
    "align-items: center",
    "justify-content: center",
    "background: rgba(0, 0, 0, 0.72)",
    "color: #fff",
    "border-radius: 6px",
    "cursor: grab",
    "user-select: none",
    "box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25)",
    "transition: background 120ms ease",
  ].join("; ");
  handle.innerHTML = HANDLE_SVG;
  handle.addEventListener("mouseenter", () => {
    handle.style.background = "rgba(0, 0, 0, 0.92)";
  });
  handle.addEventListener("mouseleave", () => {
    handle.style.background = "rgba(0, 0, 0, 0.72)";
  });
  return handle;
}

function makeIndicator(): HTMLDivElement {
  const ind = document.createElement("div");
  ind.setAttribute("data-lp-editor-only", "true");
  ind.setAttribute("contenteditable", "false");
  ind.style.cssText = [
    "position: absolute",
    "left: 8px",
    "right: 8px",
    "height: 3px",
    "background: #00f0ff",
    "border-radius: 2px",
    "box-shadow: 0 0 8px rgba(0, 240, 255, 0.6)",
    "pointer-events: none",
    "z-index: 60",
  ].join("; ");
  return ind;
}

export function attachSectionReorder(
  root: HTMLElement,
  { onChange }: ReorderOptions,
): () => void {
  // Make sure the canvas itself is a positioning context for the
  // absolute-positioned drop indicator.
  if (getComputedStyle(root).position === "static") {
    root.style.position = "relative";
  }

  const cleanupFns: Array<() => void> = [];
  let dragSource: HTMLElement | null = null;
  let indicator: HTMLDivElement | null = null;

  function getSections(): HTMLElement[] {
    return Array.from(root.children).filter(
      (n): n is HTMLElement =>
        n instanceof HTMLElement && !n.hasAttribute("data-lp-editor-only"),
    );
  }

  function moveIndicatorTo(target: HTMLElement, above: boolean) {
    if (!indicator) {
      indicator = makeIndicator();
      root.appendChild(indicator);
    }
    const rootRect = root.getBoundingClientRect();
    const tgtRect = target.getBoundingClientRect();
    const y = (above ? tgtRect.top : tgtRect.bottom) - rootRect.top;
    indicator.style.top = `${y - 1}px`;
  }

  function removeIndicator() {
    indicator?.remove();
    indicator = null;
  }

  const sections = getSections();
  if (sections.length < 2) {
    // Nothing to reorder; still attach a no-op cleanup.
    return () => {};
  }

  for (const section of sections) {
    section.setAttribute("data-lp-section", "true");
    if (getComputedStyle(section).position === "static") {
      section.style.position = "relative";
      section.dataset.lpAddedRelative = "true";
    }

    const handle = makeHandle();
    section.appendChild(handle);

    const onMouseEnter = () => {
      handle.style.display = "flex";
    };
    const onMouseLeave = () => {
      if (dragSource !== section) handle.style.display = "none";
    };
    section.addEventListener("mouseenter", onMouseEnter);
    section.addEventListener("mouseleave", onMouseLeave);

    const onDragStart = (e: DragEvent) => {
      dragSource = section;
      handle.style.cursor = "grabbing";
      handle.style.display = "flex";
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = "move";
        // Setting any data makes Firefox actually dispatch dragend.
        e.dataTransfer.setData("text/plain", "lp-section");
      }
    };
    const onDragEnd = () => {
      handle.style.cursor = "grab";
      dragSource = null;
      removeIndicator();
      // Hide all visible handles after drag.
      root.querySelectorAll<HTMLElement>(
        "[data-lp-editor-only][title='Drag to reorder section']",
      ).forEach((h) => {
        h.style.display = "none";
      });
    };
    handle.addEventListener("dragstart", onDragStart);
    handle.addEventListener("dragend", onDragEnd);

    const onDragOver = (e: DragEvent) => {
      if (!dragSource || dragSource === section) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
      const rect = section.getBoundingClientRect();
      const above = e.clientY < rect.top + rect.height / 2;
      moveIndicatorTo(section, above);
    };
    const onDrop = (e: DragEvent) => {
      if (!dragSource || dragSource === section) return;
      e.preventDefault();
      const rect = section.getBoundingClientRect();
      const above = e.clientY < rect.top + rect.height / 2;
      if (above) {
        root.insertBefore(dragSource, section);
      } else {
        root.insertBefore(dragSource, section.nextSibling);
      }
      removeIndicator();
      dragSource = null;
      onChange();
    };
    section.addEventListener("dragover", onDragOver as EventListener);
    section.addEventListener("drop", onDrop as EventListener);

    cleanupFns.push(() => {
      section.removeEventListener("mouseenter", onMouseEnter);
      section.removeEventListener("mouseleave", onMouseLeave);
      section.removeEventListener("dragover", onDragOver as EventListener);
      section.removeEventListener("drop", onDrop as EventListener);
      handle.removeEventListener("dragstart", onDragStart);
      handle.removeEventListener("dragend", onDragEnd);
      handle.remove();
      section.removeAttribute("data-lp-section");
      if (section.dataset.lpAddedRelative === "true") {
        section.style.position = "";
        delete section.dataset.lpAddedRelative;
      }
    });
  }

  return () => {
    cleanupFns.forEach((fn) => fn());
    removeIndicator();
  };
}
