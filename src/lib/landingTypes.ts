// Landing page document model.
//
// A landing page is a single block of HTML preserved verbatim from the
// source preset.  The editor renders it via innerHTML inside a
// contentEditable canvas; text is editable in place, images accept
// drag-drop replacements.  Per-preset CSS comes from `css_family` in
// meta; the matching stylesheet at
// src/components/landing/families/<family>/styles.css is injected into
// the canvas via a scoped <style> tag.

export type CssFamily = "advertorial" | "ten-reasons" | "ranking" | null;

export interface LandingDocument {
  html: string;
  meta?: {
    page_title?: string;
    page_handle?: string;
    source_url?: string;
    preset_id?: string;
    css_family?: CssFamily;
  };
}
