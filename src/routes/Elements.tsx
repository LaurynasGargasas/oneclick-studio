import { Boxes, Plus } from "lucide-react";
import { Button, Panel } from "@/components/hud";

export function Elements() {
  return (
    <div className="p-8 max-w-[1600px] mx-auto">
      <header className="mb-8 flex items-end justify-between">
        <div>
          <div className="hud-label text-fg-dim mb-1">// Reference Library</div>
          <h1 className="font-mono text-2xl uppercase tracking-[0.08em] text-fg hud-text-glow-cyan">
            Elements
          </h1>
        </div>
        <Button iconLeft={<Plus className="w-4 h-4" />}>New Element</Button>
      </header>

      <Panel className="p-16 hud-grid-bg">
        <div className="flex flex-col items-center justify-center text-center gap-4">
          <div className="relative w-16 h-16 border border-border-hud flex items-center justify-center">
            <Boxes className="w-7 h-7 text-fg-dim" strokeWidth={1.2} />
          </div>
          <div className="space-y-1">
            <h2 className="font-mono uppercase tracking-[0.15em] text-fg">Library Empty</h2>
            <p className="font-mono text-xs text-fg-muted max-w-md">
              Register reusable references — characters, props, locations, styles. Tag them with @handles and reuse across generations.
            </p>
          </div>
          <Button variant="secondary" size="sm">Register First Element</Button>
        </div>
      </Panel>
    </div>
  );
}
