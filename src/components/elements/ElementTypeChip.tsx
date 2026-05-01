import { cn } from "@/lib/cn";
import { ELEMENT_TYPE_META, type ElementType } from "@/lib/elementTypes";

interface Props {
  type: ElementType;
  size?: "sm" | "md";
  className?: string;
}

export function ElementTypeChip({ type, size = "sm", className }: Props) {
  const meta = ELEMENT_TYPE_META[type];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 border",
        "font-mono uppercase tracking-[0.12em]",
        size === "sm" && "px-1.5 py-0.5 text-[0.55rem]",
        size === "md" && "px-2 py-1 text-[0.65rem]",
        className,
      )}
      style={{
        color: meta.color,
        borderColor: meta.color,
        backgroundColor: meta.bg,
      }}
    >
      <span
        className="w-1 h-1 rounded-full"
        style={{ backgroundColor: meta.color }}
      />
      {meta.label}
    </span>
  );
}
