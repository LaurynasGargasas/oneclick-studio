import { motion } from "framer-motion";
import { cn } from "@/lib/cn";

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  size?: "sm" | "md";
  className?: string;
}

export function Toggle({ checked, onChange, label, disabled, size = "md", className }: ToggleProps) {
  const dim = size === "sm" ? { w: 36, h: 18, knob: 12 } : { w: 44, h: 22, knob: 16 };

  return (
    <label
      className={cn(
        "inline-flex items-center gap-3 cursor-pointer select-none",
        disabled && "opacity-40 cursor-not-allowed",
        className,
      )}
    >
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={cn(
          "relative border transition-all duration-200 ease-out hud-focus",
          checked
            ? "border-hud-cyan bg-hud-cyan/15 hud-glow-cyan"
            : "border-border-hud bg-bg-elevated/60 hover:border-border-strong",
        )}
        style={{ width: dim.w, height: dim.h }}
      >
        <motion.span
          className={cn(
            "absolute top-1/2 -translate-y-1/2",
            checked ? "bg-hud-cyan" : "bg-fg-muted",
          )}
          style={{ width: dim.knob, height: dim.knob }}
          animate={{ left: checked ? dim.w - dim.knob - 3 : 3 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
        />
      </button>
      {label && (
        <span className="hud-label text-fg-muted">{label}</span>
      )}
    </label>
  );
}
