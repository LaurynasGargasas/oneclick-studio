import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { CornerBrackets } from "./CornerBrackets";

type PanelVariant = "default" | "elevated" | "flat";
type PanelGlow = "none" | "cyan" | "magenta" | "green" | "amber";

interface PanelProps extends HTMLAttributes<HTMLDivElement> {
  variant?: PanelVariant;
  glow?: PanelGlow;
  brackets?: boolean;
  scanlines?: boolean;
  bracketColor?: string;
  bracketSize?: number;
  bracketInset?: number;
  children: ReactNode;
}

const glowClass: Record<PanelGlow, string> = {
  none: "",
  cyan: "hud-glow-cyan",
  magenta: "hud-glow-magenta",
  green: "hud-glow-green",
  amber: "hud-glow-amber",
};

export const Panel = forwardRef<HTMLDivElement, PanelProps>(
  (
    {
      variant = "default",
      glow = "none",
      brackets = true,
      scanlines = false,
      bracketColor,
      bracketSize = 14,
      bracketInset = -1,
      className,
      children,
      ...rest
    },
    ref,
  ) => {
    return (
      <div
        ref={ref}
        className={cn(
          "relative border",
          variant === "default" && "hud-surface border-border-hud",
          variant === "elevated" && "hud-surface-elevated border-border-strong",
          variant === "flat" && "bg-bg-panel border-border-hud",
          scanlines && "hud-scanlines",
          glowClass[glow],
          className,
        )}
        {...rest}
      >
        {brackets && (
          <CornerBrackets size={bracketSize} inset={bracketInset} color={bracketColor} />
        )}
        {children}
      </div>
    );
  },
);

Panel.displayName = "Panel";
