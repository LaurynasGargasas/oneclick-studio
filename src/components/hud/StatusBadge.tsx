import { cn } from "@/lib/cn";

export type Status = "pending" | "processing" | "completed" | "failed" | "idle";

interface StatusBadgeProps {
  status: Status;
  label?: string;
  className?: string;
}

const config: Record<Status, { label: string; color: string; bg: string; border: string; pulse: boolean }> = {
  pending: {
    label: "QUEUED",
    color: "text-fg-muted",
    bg: "bg-fg-muted/10",
    border: "border-fg-muted/40",
    pulse: false,
  },
  processing: {
    label: "PROCESSING",
    color: "text-hud-amber",
    bg: "bg-hud-amber/10",
    border: "border-hud-amber/60",
    pulse: true,
  },
  completed: {
    label: "READY",
    color: "text-hud-green",
    bg: "bg-hud-green/10",
    border: "border-hud-green/60",
    pulse: false,
  },
  failed: {
    label: "FAILED",
    color: "text-hud-red",
    bg: "bg-hud-red/10",
    border: "border-hud-red/60",
    pulse: false,
  },
  idle: {
    label: "IDLE",
    color: "text-fg-dim",
    bg: "bg-fg-dim/5",
    border: "border-fg-dim/30",
    pulse: false,
  },
};

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  const c = config[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 border",
        "font-mono text-[0.6rem] uppercase tracking-[0.15em]",
        c.bg,
        c.border,
        c.color,
        className,
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full bg-current",
          c.pulse && "hud-pulse",
        )}
      />
      {label || c.label}
    </span>
  );
}
