import { cn } from "@/lib/cn";

interface HudReticleProps {
  size?: number;
  color?: string;
  className?: string;
}

/**
 * Rotating reticle — use as a loading indicator.
 */
export function HudReticle({ size = 32, color = "var(--color-hud-cyan)", className }: HudReticleProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={cn("hud-reticle", className)}
      aria-hidden
    >
      <circle cx="16" cy="16" r="14" stroke={color} strokeWidth="1" fill="none" opacity="0.3" />
      <circle cx="16" cy="16" r="14" stroke={color} strokeWidth="1.5" fill="none" strokeDasharray="22 66" />
      <line x1="16" y1="0" x2="16" y2="6" stroke={color} strokeWidth="1" />
      <line x1="16" y1="26" x2="16" y2="32" stroke={color} strokeWidth="1" />
      <line x1="0" y1="16" x2="6" y2="16" stroke={color} strokeWidth="1" />
      <line x1="26" y1="16" x2="32" y2="16" stroke={color} strokeWidth="1" />
      <circle cx="16" cy="16" r="2" fill={color} />
    </svg>
  );
}
