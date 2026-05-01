import { Film, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button, Panel } from "@/components/hud";

export function GenerationsFeed() {
  const navigate = useNavigate();
  return (
    <div className="p-8 max-w-[1600px] mx-auto">
      {/* Header */}
      <header className="mb-8 flex items-end justify-between">
        <div>
          <div className="hud-label text-fg-dim mb-1">// Live Feed</div>
          <h1 className="font-mono text-2xl uppercase tracking-[0.08em] text-fg hud-text-glow-cyan">
            Generations
          </h1>
        </div>
        <Button iconLeft={<Plus className="w-4 h-4" />} size="md" onClick={() => navigate("/generate")}>
          New Generation
        </Button>
      </header>

      {/* Empty state — replaced with live feed in Phase 6 */}
      <Panel className="p-16 hud-grid-bg" glow="none">
        <div className="flex flex-col items-center justify-center text-center gap-4">
          <div className="relative w-16 h-16 border border-border-hud flex items-center justify-center">
            <Film className="w-7 h-7 text-fg-dim" strokeWidth={1.2} />
          </div>
          <div className="space-y-1">
            <h2 className="font-mono uppercase tracking-[0.15em] text-fg">No Generations Yet</h2>
            <p className="font-mono text-xs text-fg-muted max-w-md">
              Compose a prompt with elements, set parameters, and submit your first generation. Results stream in here as they complete.
            </p>
          </div>
          <div className="mt-3">
            <Button variant="secondary" size="sm" onClick={() => navigate("/generate")}>
              Begin Generation
            </Button>
          </div>
        </div>
      </Panel>
    </div>
  );
}
