import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/cn";

export interface SelectOption {
  value: string;
  label: string;
  icon?: ReactNode;
  color?: string;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  label?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function Select({
  value,
  onChange,
  options,
  label,
  placeholder = "Select...",
  className,
  disabled,
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <div className={cn("relative w-full", className)} ref={ref}>
      {label && (
        <span className="hud-label text-fg-muted block mb-1.5">{label}</span>
      )}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "w-full flex items-center justify-between gap-2",
          "bg-bg-elevated/60 border px-3 py-2 text-sm",
          "transition-colors hud-focus",
          "disabled:opacity-40 disabled:cursor-not-allowed",
          open
            ? "border-hud-cyan bg-bg-elevated/80"
            : "border-border-hud hover:border-hud-cyan/60",
        )}
      >
        <span className="flex items-center gap-2 truncate">
          {current?.icon}
          {current ? (
            <span style={{ color: current.color }}>{current.label}</span>
          ) : (
            <span className="text-fg-dim">{placeholder}</span>
          )}
        </span>
        <ChevronDown
          className={cn(
            "w-4 h-4 text-fg-muted transition-transform flex-shrink-0",
            open && "rotate-180",
          )}
        />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute z-30 left-0 right-0 mt-1 hud-surface-elevated border border-border-strong overflow-hidden"
          >
            {options.map((opt) => {
              const selected = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-2",
                    "text-sm text-left transition-colors",
                    "hover:bg-hud-cyan/10",
                    selected && "bg-hud-cyan/10",
                  )}
                >
                  {opt.icon}
                  <span
                    className="flex-1 truncate"
                    style={{
                      color: selected ? "var(--color-hud-cyan)" : opt.color,
                    }}
                  >
                    {opt.label}
                  </span>
                  {selected && <Check className="w-3.5 h-3.5 text-hud-cyan" />}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
