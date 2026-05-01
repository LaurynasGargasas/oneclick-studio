export interface AccentOption {
  value: string;
  name: string;
}

export const PROJECT_ACCENT_PALETTE: AccentOption[] = [
  { value: "#00f0ff", name: "Cyan" },
  { value: "#ff2e88", name: "Magenta" },
  { value: "#00ff9c", name: "Green" },
  { value: "#ffb300", name: "Amber" },
  { value: "#a855f7", name: "Purple" },
  { value: "#ff6b6b", name: "Coral" },
];

/** Convert a #RRGGBB hex to an `rgba(r, g, b, alpha)` string. */
export function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return hex;
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
