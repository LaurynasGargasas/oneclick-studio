import { Folder, Plus } from "lucide-react";
import { Button, Panel } from "@/components/hud";

export function Projects() {
  return (
    <div className="p-8 max-w-[1600px] mx-auto">
      <header className="mb-8 flex items-end justify-between">
        <div>
          <div className="hud-label text-fg-dim mb-1">// Workspaces</div>
          <h1 className="font-mono text-2xl uppercase tracking-[0.08em] text-fg hud-text-glow-cyan">
            Projects
          </h1>
        </div>
        <Button iconLeft={<Plus className="w-4 h-4" />}>New Project</Button>
      </header>

      <Panel className="p-16 hud-grid-bg">
        <div className="flex flex-col items-center justify-center text-center gap-4">
          <div className="relative w-16 h-16 border border-border-hud flex items-center justify-center">
            <Folder className="w-7 h-7 text-fg-dim" strokeWidth={1.2} />
          </div>
          <div className="space-y-1">
            <h2 className="font-mono uppercase tracking-[0.15em] text-fg">No Projects Yet</h2>
            <p className="font-mono text-xs text-fg-muted max-w-md">
              Group related generations into projects. Each project gets its own accent color and can be filtered separately.
            </p>
          </div>
          <Button variant="secondary" size="sm">Create First Project</Button>
        </div>
      </Panel>
    </div>
  );
}
