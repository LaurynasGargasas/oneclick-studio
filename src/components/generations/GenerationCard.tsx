import { useState } from "react";
import { motion } from "framer-motion";
import { Play, AlertCircle, Clock, Loader } from "lucide-react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { StatusBadge } from "@/components/hud";
import { CornerBrackets } from "@/components/hud/CornerBrackets";
import { isTauri } from "@/lib/tauri";
import { relativeTime } from "@/lib/relativeTime";
import { cn } from "@/lib/cn";
import type { Generation } from "@/stores/generationsStore";

interface Props {
  generation: Generation;
  onClick: () => void;
}

/** Convert a video_path (local file or remote URL) to something <video> can use. */
function toVideoSrc(path: string): string {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  if (isTauri) return convertFileSrc(path);
  return path;
}

export function GenerationCard({ generation: g, onClick }: Props) {
  const [thumbError, setThumbError] = useState(false);
  const videoSrc = g.video_path ? toVideoSrc(g.video_path) : null;

  return (
    <motion.div
      whileHover={g.status === "completed" ? { y: -2, borderColor: "var(--color-hud-cyan)" } : {}}
      transition={{ duration: 0.15 }}
      onClick={onClick}
      className={cn(
        "relative border border-border-hud bg-bg-panel/60 backdrop-blur-md overflow-hidden",
        "cursor-pointer group",
        g.status === "completed" && "hover:shadow-[0_0_24px_rgba(0,240,255,0.2)]",
      )}
    >
      <CornerBrackets
        size={8}
        inset={-1}
        color={
          g.status === "completed" ? "var(--color-hud-cyan)"
          : g.status === "failed" ? "var(--color-hud-red)"
          : "var(--color-border-hud)"
        }
      />

      {/* Thumbnail / preview area */}
      <div className="relative aspect-video bg-bg-elevated overflow-hidden">
        {g.status === "completed" && videoSrc && !thumbError ? (
          <>
            <video
              src={videoSrc}
              className="w-full h-full object-cover"
              muted
              preload="metadata"
              onError={() => setThumbError(true)}
            />
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-bg-base/40">
              <div className="w-12 h-12 border border-hud-cyan flex items-center justify-center bg-bg-base/60">
                <Play className="w-5 h-5 text-hud-cyan ml-0.5" fill="currentColor" />
              </div>
            </div>
          </>
        ) : g.status === "processing" ? (
          <div className="absolute inset-0 hud-grid-bg flex flex-col items-center justify-center gap-3">
            <Loader className="w-8 h-8 text-hud-amber animate-spin" strokeWidth={1.5} />
            <span className="hud-label text-hud-amber hud-pulse">Rendering…</span>
          </div>
        ) : g.status === "pending" ? (
          <div className="absolute inset-0 hud-grid-bg flex flex-col items-center justify-center gap-3">
            <Clock className="w-8 h-8 text-fg-dim" strokeWidth={1.5} />
            <span className="hud-label text-fg-muted">Queued</span>
          </div>
        ) : g.status === "failed" ? (
          <div className="absolute inset-0 bg-hud-red/5 flex flex-col items-center justify-center gap-2 px-4 text-center">
            <AlertCircle className="w-8 h-8 text-hud-red" strokeWidth={1.5} />
            <span className="font-mono text-[0.6rem] text-hud-red/80 leading-relaxed line-clamp-3">
              {g.error_message ?? "Generation failed"}
            </span>
          </div>
        ) : (
          <div className="absolute inset-0 hud-grid-bg" />
        )}
      </div>

      {/* Info footer */}
      <div className="p-3 border-t border-border-hud">
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <StatusBadge status={g.status} />
          <span className="font-mono text-[0.6rem] text-fg-dim shrink-0">
            {relativeTime(g.created_at)}
          </span>
        </div>
        <p className="font-mono text-xs text-fg leading-snug line-clamp-2">
          {g.prompt_raw}
        </p>
        <div className="flex items-center gap-3 mt-2 font-mono text-[0.6rem] text-fg-dim">
          <span>{g.resolution}</span>
          <span>·</span>
          <span>{g.duration_s}s</span>
          <span>·</span>
          <span>{g.aspect_ratio}</span>
        </div>
      </div>
    </motion.div>
  );
}
