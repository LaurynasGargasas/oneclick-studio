// Editor helpers — wire drag-drop / click-to-upload onto every <img>
// and <video> in a freshly-rendered preset.  Runs after the canvas's
// innerHTML is set; marks media as contenteditable=false so the
// surrounding contentEditable doesn't treat them as text.
//
// Also exports `executeScripts(root)` which re-runs every inline
// <script> in the freshly-inserted markup.  Browsers leave such
// scripts inert when set via innerHTML — without this, the source
// HTML's FAQ accordions, countdown timers, sticky CTAs, and the
// ranking-page carousel never wake up.

/**
 * Rewrite every inline `<style>` inside `root` so width-based @media
 * queries become @container queries.  The editor canvas is a container
 * (via `container-type: inline-size`), so this is what makes the
 * mobile-preview toggle actually trigger responsive breakpoints in the
 * styles bundled inside each preset's HTML.  On save we invert the
 * transform — see `serializeCanvas`.
 */
export function transformInlineMediaToContainer(root: HTMLElement): void {
  const styles = root.querySelectorAll("style");
  for (const s of Array.from(styles)) {
    if (!s.textContent) continue;
    const next = s.textContent.replace(
      /@media\b[^{]*?(\(\s*(?:max|min)-width\s*:\s*[^)]+\))/g,
      "@container $1",
    );
    if (next !== s.textContent) s.textContent = next;
  }
}

/**
 * Re-execute every `<script>` inside `root`.  Replaces each inert
 * script tag with a freshly-created one (browsers DO execute scripts
 * created via createElement + inserted into the DOM).
 */
export function executeScripts(root: HTMLElement): void {
  const scripts = Array.from(root.querySelectorAll("script"));
  for (const old of scripts) {
    const fresh = document.createElement("script");
    for (const attr of Array.from(old.attributes)) {
      try {
        fresh.setAttribute(attr.name, attr.value);
      } catch {
        /* ignore invalid attr names */
      }
    }
    fresh.textContent = old.textContent ?? "";
    old.replaceWith(fresh);
  }
}

const ACCEPT_IMAGE = "image/*,video/*";
const ACCEPT_VIDEO = "video/*";
const DROP_OUTLINE = "2px dashed #00f0ff";

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = () => reject(fr.error);
    fr.readAsDataURL(file);
  });
}

async function replaceMedia(
  el: HTMLImageElement | HTMLVideoElement,
  file: File,
): Promise<void> {
  const dataUrl = await readAsDataUrl(file);
  if (el.tagName === "IMG") {
    const img = el as HTMLImageElement;
    img.src = dataUrl;
    // srcset / sibling <source> children would otherwise win — strip them.
    img.removeAttribute("srcset");
    const picture = img.closest("picture");
    if (picture) {
      picture.querySelectorAll("source").forEach((s) => s.remove());
    }
  } else {
    const video = el as HTMLVideoElement;
    video.src = dataUrl;
    video.querySelectorAll("source").forEach((s) => s.remove());
    video.load();
  }
}

export interface AttachOptions {
  onChange: () => void;
}

/**
 * Bind drag-drop + click-to-upload to every <img>/<video> under `root`.
 * Returns a cleanup function that removes the listeners.
 */
export function attachMediaHandlers(
  root: HTMLElement,
  { onChange }: AttachOptions,
): () => void {
  const cleanups: Array<() => void> = [];

  const media = root.querySelectorAll<HTMLImageElement | HTMLVideoElement>(
    "img, video",
  );

  // <source> children inside <picture>/<video> aren't interactive themselves;
  // they just need to opt out of contenteditable so the surrounding canvas
  // doesn't try to type into them.
  root.querySelectorAll("source").forEach((s) => {
    s.setAttribute("contenteditable", "false");
  });

  media.forEach((el) => {
    el.setAttribute("contenteditable", "false");
    el.setAttribute("draggable", "false");
    el.style.cursor = "pointer";

    const onDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      el.style.outline = DROP_OUTLINE;
      el.style.outlineOffset = "-2px";
    };
    const onDragLeave = () => {
      el.style.outline = "";
      el.style.outlineOffset = "";
    };
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      el.style.outline = "";
      el.style.outlineOffset = "";
      const file = e.dataTransfer?.files?.[0];
      if (!file) return;
      void replaceMedia(el, file).then(onChange);
    };
    const onClick = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const input = document.createElement("input");
      input.type = "file";
      input.accept = el.tagName === "VIDEO" ? ACCEPT_VIDEO : ACCEPT_IMAGE;
      input.addEventListener("change", () => {
        const file = input.files?.[0];
        if (!file) return;
        void replaceMedia(el, file).then(onChange);
      });
      input.click();
    };

    // Single shared cast — addEventListener's typed overloads can't satisfy
    // the (img|video) union when the listener is one shape.
    const addListener = el.addEventListener.bind(el) as (
      type: string,
      listener: (e: Event) => void,
    ) => void;
    const removeListener = el.removeEventListener.bind(el) as (
      type: string,
      listener: (e: Event) => void,
    ) => void;

    addListener("dragover", onDragOver as (e: Event) => void);
    addListener("dragleave", onDragLeave as (e: Event) => void);
    addListener("drop", onDrop as (e: Event) => void);
    addListener("click", onClick as (e: Event) => void);

    cleanups.push(() => {
      removeListener("dragover", onDragOver as (e: Event) => void);
      removeListener("dragleave", onDragLeave as (e: Event) => void);
      removeListener("drop", onDrop as (e: Event) => void);
      removeListener("click", onClick as (e: Event) => void);
    });
  });

  return () => cleanups.forEach((fn) => fn());
}
