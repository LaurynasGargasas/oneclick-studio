import { motion } from "framer-motion";
import { Folder } from "lucide-react";
import { Link } from "react-router-dom";
import { CornerBrackets } from "@/components/hud/CornerBrackets";
import { withAlpha } from "@/lib/projectColors";
import { relativeTime } from "@/lib/relativeTime";
import { cn } from "@/lib/cn";
import type { Project } from "@/stores/projectsStore";

interface Props {
  project: Project;
  generationCount?: number;
}

export function ProjectCard({ project, generationCount = 0 }: Props) {
  const accent = project.color_accent;

  return (
    <Link to={`/projects/${project.id}`} className="block hud-focus">
      <motion.div
        whileHover={{
          y: -2,
          borderColor: accent,
          boxShadow: `0 0 24px ${withAlpha(accent, 0.4)}, 0 0 48px ${withAlpha(accent, 0.15)}`,
        }}
        transition={{ duration: 0.18 }}
        className={cn(
          "relative border border-border-hud bg-bg-panel/60 backdrop-blur-md",
          "hud-scanline-sweep overflow-hidden",
        )}
      >
        <CornerBrackets size={10} inset={-1} color={accent} />

        {/* Accent stripe at top */}
        <div
          className="absolute top-0 left-0 right-0 h-px z-10"
          style={{
            backgroundColor: accent,
            boxShadow: `0 0 8px ${accent}`,
          }}
        />

        <div className="relative aspect-[16/10] overflow-hidden">
          {project.cover_image ? (
            <img
              src={project.cover_image}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : (
            <div
              className="absolute inset-0 hud-grid-bg flex items-center justify-center"
              style={{
                background: `radial-gradient(ellipse at center, ${withAlpha(accent, 0.1)}, transparent 70%)`,
              }}
            >
              <Folder
                className="w-12 h-12"
                strokeWidth={1.2}
                style={{ color: accent, opacity: 0.7 }}
              />
            </div>
          )}
        </div>

        <div className="p-4 border-t border-border-hud">
          <div
            className="hud-label mb-1"
            style={{ color: accent }}
          >
            // Project
          </div>
          <div className="font-mono text-sm text-fg uppercase tracking-[0.05em] truncate">
            {project.name}
          </div>
          <div className="flex items-center gap-2 mt-2 font-mono text-[0.6rem] text-fg-dim uppercase tracking-[0.1em]">
            <span>{generationCount} GEN</span>
            <span>·</span>
            <span>{relativeTime(project.updated_at)}</span>
          </div>
        </div>
      </motion.div>
    </Link>
  );
}
