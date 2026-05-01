import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

interface HudInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  mono?: boolean;
}

export const HudInput = forwardRef<HTMLInputElement, HudInputProps>(
  ({ label, error, hint, mono, className, ...rest }, ref) => {
    return (
      <label className="flex flex-col gap-1.5 w-full">
        {label && <span className="hud-label text-fg-muted">{label}</span>}
        <input
          ref={ref}
          className={cn(
            "w-full bg-bg-elevated/60 border border-border-hud px-3 py-2",
            "text-sm text-fg placeholder:text-fg-dim",
            "transition-colors hud-focus",
            "focus:border-hud-cyan focus:bg-bg-elevated/80",
            mono && "font-mono",
            error && "border-hud-red",
            className,
          )}
          {...rest}
        />
        {error && <span className="font-mono text-[0.65rem] text-hud-red">{error}</span>}
        {hint && !error && <span className="font-mono text-[0.65rem] text-fg-dim">{hint}</span>}
      </label>
    );
  },
);

HudInput.displayName = "HudInput";
