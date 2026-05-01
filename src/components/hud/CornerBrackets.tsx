import { motion } from "framer-motion";
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
 * Four animated corner reticles drawn into the parent's corners.
 * Parent must be `position: relative`.
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

  return (
    <div className={cn("pointer-events-none absolute inset-0", className)} aria-hidden>
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
          <motion.path
            d={c.d}
            stroke={color}
            strokeWidth={thickness}
            fill="none"
            strokeLinecap="square"
            initial={animate ? { pathLength: 0, opacity: 0 } : false}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 0.55, ease: [0.2, 0.8, 0.2, 1] }}
          />
        </svg>
      ))}
    </div>
  );
}
