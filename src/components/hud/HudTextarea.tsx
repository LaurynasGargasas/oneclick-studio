import { forwardRef, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

interface HudTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
  mono?: boolean;
}

export const HudTextarea = forwardRef<HTMLTextAreaElement, HudTextareaProps>(
  ({ label, error, hint, mono, className, ...rest }, ref) => {
    return (
      <label className="flex flex-col gap-1.5 w-full">
        {label && <span className="hud-label text-fg-muted">{label}</span>}
        <textarea
          ref={ref}
          className={cn(
            "w-full bg-bg-elevated/60 border border-border-hud px-3 py-2",
            "text-sm text-fg placeholder:text-fg-dim",
            "transition-colors hud-focus resize-y min-h-[80px]",
            "focus:border-hud-cyan focus:bg-bg-elevated/80",
            mono && "font-mono",
            error && "border-hud-red",
            className,
          )}
          {...rest}
        />
        {error && (
          <span className="font-mono text-[0.65rem] text-hud-red">{error}</span>
        )}
        {hint && !error && (
          <span className="font-mono text-[0.65rem] text-fg-dim">{hint}</span>
        )}
      </label>
    );
  },
);

HudTextarea.displayName = "HudTextarea";
