import { cn } from "@/lib/cn";

interface CornerBracketsProps {
  size?: number;
  thickness?: number;
  color?: string;
  inset?: number;
  animate?: boolean;
  className?: string;
}

/**
 * Four corner reticles drawn into the parent's corners.
 * Parent must be `position: relative`.
 *
 * Animation is CSS-based (stroke-dasharray draw-on) to avoid React 19 + SVG
 * compatibility issues with framer-motion's animated SVG elements.
 */
export function CornerBrackets({
  size = 14,
  thickness = 1,
  color = "var(--color-hud-cyan)",
  inset = 0,
  animate = true,
  className,
}: CornerBracketsProps) {
  const corners: Array<{ x: "left" | "right"; y: "top" | "bottom"; d: string }> = [
    { x: "left", y: "top", d: `M 0 ${size} L 0 0 L ${size} 0` },
    { x: "right", y: "top", d: `M ${size} ${size} L ${size} 0 L 0 0` },
    { x: "left", y: "bottom", d: `M 0 0 L 0 ${size} L ${size} ${size}` },
    { x: "right", y: "bottom", d: `M 0 ${size} L ${size} ${size} L ${size} 0` },
  ];

  // Each path is two segments of length `size`, plus a tiny corner overlap.
  const dashLength = size * 2 + 1;

  return (
    <div
      className={cn("pointer-events-none absolute inset-0", className)}
      aria-hidden
    >
      {corners.map((c) => (
        <svg
          key={`${c.x}-${c.y}`}
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="absolute"
          style={{
            [c.x]: inset,
            [c.y]: inset,
          }}
        >
          <path
            d={c.d}
            stroke={color}
            strokeWidth={thickness}
            fill="none"
            strokeLinecap="square"
            style={
              animate
                ? {
                    strokeDasharray: dashLength,
                    strokeDashoffset: dashLength,
                    animation: `hud-bracket-draw 0.55s cubic-bezier(0.2, 0.8, 0.2, 1) forwards`,
                  }
                : undefined
            }
          />
        </svg>
      ))}
    </div>
  );
}
