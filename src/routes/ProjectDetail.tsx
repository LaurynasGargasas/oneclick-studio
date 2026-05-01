import { useParams, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Panel } from "@/components/hud";

export function ProjectDetail() {
  const { id } = useParams<{ id: string }>();

  return (
    <div className="p-8 max-w-[1600px] mx-auto">
      <Link
        to="/projects"
        className="inline-flex items-center gap-2 mb-6 font-mono text-[0.7rem] uppercase tracking-[0.15em] text-fg-muted hover:text-hud-cyan transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to Projects
      </Link>
      <Panel className="p-12">
        <div className="hud-label text-fg-dim mb-2">// Project</div>
        <h1 className="font-mono text-xl uppercase tracking-[0.08em] text-fg">{id}</h1>
        <p className="mt-3 font-mono text-xs text-fg-muted">Project view stub — implemented in Phase 3.</p>
      </Panel>
    </div>
  );
}
