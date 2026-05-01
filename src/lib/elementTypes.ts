export type ElementType = "character" | "prop" | "location" | "style" | "other";

export const ELEMENT_TYPES: ElementType[] = [
  "character",
  "prop",
  "location",
  "style",
  "other",
];

interface ElementTypeMeta {
  label: string;
  color: string;
  bg: string;
  description: string;
}

export const ELEMENT_TYPE_META: Record<ElementType, ElementTypeMeta> = {
  character: {
    label: "Character",
    color: "var(--color-hud-cyan)",
    bg: "rgba(0, 240, 255, 0.1)",
    description: "People, creatures, named subjects",
  },
  prop: {
    label: "Prop",
    color: "var(--color-hud-amber)",
    bg: "rgba(255, 179, 0, 0.1)",
    description: "Objects, items, gear",
  },
  location: {
    label: "Location",
    color: "var(--color-hud-green)",
    bg: "rgba(0, 255, 156, 0.1)",
    description: "Places, settings, environments",
  },
  style: {
    label: "Style",
    color: "var(--color-hud-magenta)",
    bg: "rgba(255, 46, 136, 0.1)",
    description: "Visual style, mood, aesthetic",
  },
  other: {
    label: "Other",
    color: "var(--color-fg-muted)",
    bg: "rgba(143, 163, 184, 0.1)",
    description: "Anything else",
  },
};
