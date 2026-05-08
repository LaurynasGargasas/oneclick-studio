// Reusable single-/multi-select chip group for the Character Creator.
// Single-select: clicking a chip selects it; clicking the same chip clears.
// Multi-select: each chip toggles independently.

import { cn } from "@/lib/cn";
import { HudInput } from "@/components/hud";
import type { OptionDef } from "@/lib/characterPrompt";

interface BaseProps {
  label: string;
  options: OptionDef[];
}

interface SingleProps extends BaseProps {
  kind: "single";
  value: string | undefined;
  onChange: (v: string | undefined) => void;
  /** Optional "Other…" chip + free-text input. */
  allowOther?: boolean;
  otherValue?: string;
  onOtherChange?: (v: string) => void;
}

interface MultiProps extends BaseProps {
  kind: "multi";
  value: string[];
  onChange: (v: string[]) => void;
}

export function OptionChips(props: SingleProps | MultiProps) {
  return (
    <div>
      <div className="hud-label text-fg-dim mb-2">{props.label}</div>
      <div className="flex flex-wrap gap-1.5">
        {props.options.map((opt) => {
          const active =
            props.kind === "single"
              ? props.value === opt.id
              : props.value.includes(opt.id);
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => {
                if (props.kind === "single") {
                  props.onChange(active ? undefined : opt.id);
                } else {
                  if (active) props.onChange(props.value.filter((x) => x !== opt.id));
                  else props.onChange([...props.value, opt.id]);
                }
              }}
              className={cn(
                "px-3 py-1.5 font-mono text-[0.7rem] uppercase tracking-[0.08em]",
                "border transition-colors duration-100 hud-focus",
                active
                  ? "bg-hud-cyan/15 border-hud-cyan text-hud-cyan hud-text-glow-cyan"
                  : "bg-bg-elevated/30 border-border-hud text-fg-muted hover:text-fg hover:border-hud-cyan/40",
              )}
            >
              {opt.label}
            </button>
          );
        })}

        {props.kind === "single" && props.allowOther && (
          <button
            type="button"
            onClick={() =>
              props.onChange(props.value === "other" ? undefined : "other")
            }
            className={cn(
              "px-3 py-1.5 font-mono text-[0.7rem] uppercase tracking-[0.08em]",
              "border transition-colors duration-100 hud-focus",
              props.value === "other"
                ? "bg-hud-cyan/15 border-hud-cyan text-hud-cyan hud-text-glow-cyan"
                : "bg-bg-elevated/30 border-border-hud text-fg-muted hover:text-fg hover:border-hud-cyan/40",
            )}
          >
            Other
          </button>
        )}
      </div>

      {props.kind === "single" && props.allowOther && props.value === "other" && (
        <div className="mt-2">
          <HudInput
            placeholder={`e.g. firefighter uniform`}
            value={props.otherValue ?? ""}
            onChange={(e) => props.onOtherChange?.(e.target.value)}
          />
        </div>
      )}
    </div>
  );
}
