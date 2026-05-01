import { Panel } from "@/components/hud";

export function Generator() {
  return (
    <div className="p-8 max-w-[1600px] mx-auto">
      <Panel className="p-12">
        <div className="hud-label text-fg-dim mb-2">// Composer</div>
        <h1 className="font-mono text-xl uppercase tracking-[0.08em] text-fg">Generator</h1>
        <p className="mt-3 font-mono text-xs text-fg-muted">
          Three-panel generator stub — built out in Phase 5.
        </p>
      </Panel>
    </div>
  );
}
