// Serialize the editor canvas back to clean HTML.
//
// During edit we attach drag handles, formatting overlays, and other
// chrome with `data-lp-editor-only` so the user can manipulate sections.
// Before saving (or exporting), we clone the canvas, strip those nodes,
// and return the resulting innerHTML — the saved document never sees
// editor-only DOM.

export function serializeCanvas(canvas: HTMLElement): string {
  const clone = canvas.cloneNode(true) as HTMLElement;
  clone
    .querySelectorAll("[data-lp-editor-only]")
    .forEach((n) => n.remove());
  // Editor draggable + relative positioning helpers we add at runtime
  // shouldn't leak into the saved HTML either.
  clone.querySelectorAll("[data-lp-section]").forEach((el) => {
    el.removeAttribute("data-lp-section");
    el.removeAttribute("draggable");
    // Clear inline position:relative if we set it for handle anchoring.
    if (
      el instanceof HTMLElement &&
      el.dataset.lpAddedRelative === "true"
    ) {
      el.style.position = "";
      el.removeAttribute("data-lp-added-relative");
    }
  });
  // Invert the inline @media → @container rewrite we do at render time
  // (transformInlineMediaToContainer).  The saved/exported HTML lives in
  // a real browser whose viewport drives layout, so @media is the right
  // form there.
  clone.querySelectorAll("style").forEach((s) => {
    if (!s.textContent) return;
    const next = s.textContent.replace(
      /@container\s+(\(\s*(?:max|min)-width\s*:\s*[^)]+\))/g,
      "@media $1",
    );
    if (next !== s.textContent) s.textContent = next;
  });
  return clone.innerHTML;
}
