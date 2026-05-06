import { AnimatePresence, motion } from "framer-motion";
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from "lucide-react";
import { useToastStore, type ToastVariant } from "@/stores/toastStore";

// ── colours per variant ───────────────────────────────────────────────────────

const VARIANT_STYLES: Record<
  ToastVariant,
  { border: string; glow: string; icon: string; Icon: React.ComponentType<{ className?: string }> }
> = {
  success: {
    border: "border-hud-cyan",
    glow: "shadow-[0_0_16px_rgba(0,240,255,0.25)]",
    icon: "text-hud-cyan",
    Icon: CheckCircle,
  },
  error: {
    border: "border-hud-red",
    glow: "shadow-[0_0_16px_rgba(255,60,60,0.25)]",
    icon: "text-hud-red",
    Icon: AlertCircle,
  },
  warning: {
    border: "border-hud-amber",
    glow: "shadow-[0_0_16px_rgba(255,200,0,0.20)]",
    icon: "text-hud-amber",
    Icon: AlertTriangle,
  },
  info: {
    border: "border-border-hud",
    glow: "",
    icon: "text-fg-muted",
    Icon: Info,
  },
};

// ── single toast ──────────────────────────────────────────────────────────────

function ToastCard({ id, variant, title, body }: { id: string; variant: ToastVariant; title: string; body?: string }) {
  const dismiss = useToastStore((s) => s.dismiss);
  const { border, glow, icon, Icon } = VARIANT_STYLES[variant];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 48, scale: 0.96 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 48, scale: 0.96 }}
      transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
      className={`relative flex items-start gap-3 w-80 bg-bg-panel/95 backdrop-blur-sm border ${border} ${glow} px-4 py-3`}
    >
      {/* Corner accent */}
      <span className={`absolute top-0 left-0 w-2 h-2 border-t border-l ${border}`} />
      <span className={`absolute bottom-0 right-0 w-2 h-2 border-b border-r ${border}`} />

      <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${icon}`} />

      <div className="flex-1 min-w-0">
        <p className="font-mono text-xs text-fg leading-snug">{title}</p>
        {body && (
          <p className="font-mono text-[0.6rem] text-fg-muted mt-0.5 leading-relaxed">{body}</p>
        )}
      </div>

      <button
        type="button"
        onClick={() => dismiss(id)}
        className="shrink-0 mt-0.5 text-fg-dim hover:text-fg transition-colors"
        aria-label="Dismiss"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </motion.div>
  );
}

// ── container ─────────────────────────────────────────────────────────────────

export function ToastContainer() {
  const items = useToastStore((s) => s.items);

  return (
    <div
      aria-live="polite"
      className="fixed bottom-6 right-6 z-[200] flex flex-col gap-2 pointer-events-none"
    >
      <AnimatePresence initial={false}>
        {items.map((t) => (
          <div key={t.id} className="pointer-events-auto">
            <ToastCard {...t} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
}
