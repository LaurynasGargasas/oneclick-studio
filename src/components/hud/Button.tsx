import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "success";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  loading?: boolean;
}

const sizeClass: Record<Size, string> = {
  sm: "h-8 px-3 text-[0.65rem] gap-1.5",
  md: "h-10 px-5 text-xs gap-2",
  lg: "h-12 px-7 text-sm gap-2.5",
};

const variantClass: Record<Variant, string> = {
  primary: cn(
    "bg-hud-cyan/[0.08] border-hud-cyan/60 text-hud-cyan",
    "hover:bg-hud-cyan/15 hover:border-hud-cyan hover:hud-glow-cyan",
    "active:bg-hud-cyan/25",
  ),
  secondary: cn(
    "bg-bg-elevated/40 border-border-hud text-fg",
    "hover:bg-bg-elevated/70 hover:border-hud-cyan/60 hover:text-hud-cyan",
  ),
  ghost: cn(
    "bg-transparent border-transparent text-fg-muted",
    "hover:text-hud-cyan hover:border-border-hud",
  ),
  danger: cn(
    "bg-hud-red/10 border-hud-red/60 text-hud-red",
    "hover:bg-hud-red/20 hover:border-hud-red hover:hud-glow-red",
  ),
  success: cn(
    "bg-hud-green/10 border-hud-green/60 text-hud-green",
    "hover:bg-hud-green/20 hover:border-hud-green hover:hud-glow-green",
  ),
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { variant = "primary", size = "md", className, children, iconLeft, iconRight, loading, disabled, ...rest },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          "relative inline-flex items-center justify-center",
          "border font-mono uppercase tracking-[0.12em] font-medium",
          "transition-all duration-150 ease-out",
          "hud-focus disabled:opacity-40 disabled:cursor-not-allowed",
          "select-none",
          sizeClass[size],
          variantClass[variant],
          className,
        )}
        {...rest}
      >
        {loading ? (
          <span className="inline-flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-current hud-pulse" />
            <span className="h-1.5 w-1.5 rounded-full bg-current hud-pulse" style={{ animationDelay: "0.2s" }} />
            <span className="h-1.5 w-1.5 rounded-full bg-current hud-pulse" style={{ animationDelay: "0.4s" }} />
          </span>
        ) : (
          <>
            {iconLeft && <span className="flex-shrink-0">{iconLeft}</span>}
            <span>{children}</span>
            {iconRight && <span className="flex-shrink-0">{iconRight}</span>}
          </>
        )}
      </button>
    );
  },
);

Button.displayName = "Button";
