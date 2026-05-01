import { Check } from "lucide-react";
import { cn } from "@/lib/cn";

interface Option {
  value: string;
  name?: string;
}

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  options: Option[];
  label?: string;
  className?: string;
  size?: "sm" | "md";
}

export function ColorPicker({
  value,
  onChange,
  options,
  label,
  className,
  size = "md",
}: ColorPickerProps) {
  const dim = size === "sm" ? "w-7 h-7" : "w-9 h-9";

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {label && <span className="hud-label text-fg-muted">{label}</span>}
      <div className="flex gap-2">
        {options.map((opt) => {
          const selected = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              title={opt.name}
              aria-label={opt.name || opt.value}
              className={cn(
                "relative border transition-all hud-focus",
                "hover:scale-110",
                selected && "scale-110",
                dim,
              )}
              style={{
                backgroundColor: opt.value,
                borderColor: selected ? "#ffffff" : "var(--color-border-hud)",
                boxShadow: selected ? `0 0 16px ${opt.value}99` : undefined,
              }}
            >
              {selected && (
                <Check
                  className="absolute inset-0 m-auto w-4 h-4 text-white"
                  style={{ mixBlendMode: "difference" }}
                  strokeWidth={3}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
