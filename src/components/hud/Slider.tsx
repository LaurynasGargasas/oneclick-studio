import { useRef, useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/cn";

interface SliderProps {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  ticks?: number[];
  label?: string;
  unit?: string;
  disabled?: boolean;
  className?: string;
}

export function Slider({
  value,
  onChange,
  min,
  max,
  step = 1,
  ticks,
  label,
  unit,
  disabled,
  className,
}: SliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  const pct = ((value - min) / (max - min)) * 100;

  const updateFromClientX = useCallback(
    (clientX: number) => {
      if (!trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const raw = min + ratio * (max - min);
      const snapped = Math.round(raw / step) * step;
      const clamped = Math.max(min, Math.min(max, snapped));
      onChange(clamped);
    },
    [min, max, step, onChange],
  );

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: PointerEvent) => updateFromClientX(e.clientX);
    const onUp = () => setDragging(false);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [dragging, updateFromClientX]);

  return (
    <div className={cn("flex flex-col gap-2", disabled && "opacity-40", className)}>
      {(label || unit) && (
        <div className="flex items-baseline justify-between">
          {label && <span className="hud-label text-fg-muted">{label}</span>}
          <span className="font-mono text-xs text-hud-cyan tabular-nums">
            {value}
            {unit && <span className="ml-0.5 text-fg-dim">{unit}</span>}
          </span>
        </div>
      )}
      <div
        ref={trackRef}
        className={cn(
          "relative h-6 cursor-pointer select-none",
          disabled && "cursor-not-allowed",
        )}
        onPointerDown={(e) => {
          if (disabled) return;
          setDragging(true);
          updateFromClientX(e.clientX);
        }}
      >
        {/* track base */}
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-px bg-border-hud" />
        {/* filled portion */}
        <div
          className="absolute top-1/2 -translate-y-1/2 h-px bg-hud-cyan hud-glow-cyan"
          style={{ width: `${pct}%` }}
        />
        {/* ticks */}
        {ticks?.map((t) => {
          const tPct = ((t - min) / (max - min)) * 100;
          return (
            <div
              key={t}
              className={cn(
                "absolute top-1/2 -translate-y-1/2 w-px h-2",
                t <= value ? "bg-hud-cyan/60" : "bg-border-strong",
              )}
              style={{ left: `${tPct}%` }}
            />
          );
        })}
        {/* knob */}
        <div
          className={cn(
            "absolute top-1/2 -translate-y-1/2 -translate-x-1/2",
            "w-3 h-3 border bg-bg-base transition-shadow",
            "border-hud-cyan",
            dragging && "hud-glow-cyan scale-110",
          )}
          style={{ left: `${pct}%` }}
        />
      </div>
    </div>
  );
}
