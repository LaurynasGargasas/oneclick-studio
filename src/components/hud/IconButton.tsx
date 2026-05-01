import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/cn";

type Variant = "default" | "danger" | "primary";
type Size = "sm" | "md" | "lg";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
}

const sizeClass: Record<Size, string> = {
  sm: "w-7 h-7",
  md: "w-9 h-9",
  lg: "w-11 h-11",
};

const variantClass: Record<Variant, string> = {
  default:
    "border-border-hud bg-bg-elevated/40 text-fg-muted hover:border-hud-cyan hover:text-hud-cyan",
  primary:
    "border-hud-cyan/60 bg-hud-cyan/10 text-hud-cyan hover:border-hud-cyan hover:hud-glow-cyan",
  danger:
    "border-border-hud bg-bg-elevated/40 text-fg-muted hover:border-hud-red hover:text-hud-red",
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ variant = "default", size = "md", className, children, ...rest }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center border transition-all hud-focus",
          "disabled:opacity-40 disabled:cursor-not-allowed",
          sizeClass[size],
          variantClass[variant],
          className,
        )}
        {...rest}
      >
        {children}
      </button>
    );
  },
);

IconButton.displayName = "IconButton";
