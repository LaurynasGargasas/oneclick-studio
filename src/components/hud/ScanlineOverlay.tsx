import { cn } from "@/lib/cn";

interface ScanlineOverlayProps {
  intensity?: "subtle" | "medium" | "strong";
  className?: string;
}

/**
 * Pure CSS scanline overlay. Place inside a `position: relative` parent.
 */
export function ScanlineOverlay({ intensity = "subtle", className }: ScanlineOverlayProps) {
  const opacity = intensity === "subtle" ? 0.018 : intensity === "medium" ? 0.04 : 0.07;

  return (
    <div
      aria-hidden
      className={cn("pointer-events-none absolute inset-0 mix-blend-screen", className)}
      style={{
        backgroundImage: `repeating-linear-gradient(0deg, transparent 0, transparent 2px, rgba(255,255,255,${opacity}) 2px, rgba(255,255,255,${opacity}) 3px)`,
      }}
    />
  );
}
