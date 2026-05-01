import { useState } from "react";
import { Zap, Cpu, Radio, AlertTriangle } from "lucide-react";
import {
  Panel,
  Button,
  Toggle,
  Slider,
  StatusBadge,
  HudReticle,
  HudInput,
  ScanlineOverlay,
} from "@/components/hud";

export function HudDemo() {
  const [tog1, setTog1] = useState(true);
  const [tog2, setTog2] = useState(false);
  const [duration, setDuration] = useState(8);
  const [text, setText] = useState("");

  return (
    <div className="p-8 max-w-[1400px] mx-auto space-y-10">
      <header>
        <div className="hud-label text-hud-magenta mb-1">// /dev/hud — design system</div>
        <h1 className="font-mono text-2xl uppercase tracking-[0.08em] text-fg hud-text-glow-cyan">
          HUD Components
        </h1>
        <p className="mt-2 font-mono text-xs text-fg-muted max-w-2xl">
          Interactive showcase of every primitive. Use this page during development to verify visual polish.
        </p>
      </header>

      {/* Buttons */}
      <Panel className="p-6">
        <div className="hud-label text-fg-muted mb-4">Buttons</div>
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Button variant="primary">Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="success">Success</Button>
            <Button variant="danger">Danger</Button>
            <Button disabled>Disabled</Button>
            <Button loading>Loading</Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm" iconLeft={<Zap className="w-3 h-3" />}>Small</Button>
            <Button size="md" iconLeft={<Cpu className="w-4 h-4" />}>Medium</Button>
            <Button size="lg" iconRight={<Radio className="w-4 h-4" />}>Large</Button>
          </div>
        </div>
      </Panel>

      {/* Panels */}
      <div className="grid grid-cols-3 gap-4">
        <Panel className="p-6 h-32 flex items-center justify-center">
          <span className="hud-label text-fg-muted">Default</span>
        </Panel>
        <Panel variant="elevated" className="p-6 h-32 flex items-center justify-center">
          <span className="hud-label text-fg-muted">Elevated</span>
        </Panel>
        <Panel glow="cyan" className="p-6 h-32 flex items-center justify-center">
          <span className="hud-label text-hud-cyan">Glow</span>
        </Panel>
        <Panel scanlines className="p-6 h-32 flex items-center justify-center hud-scanline-sweep">
          <span className="hud-label text-fg-muted">Hover for sweep</span>
        </Panel>
        <Panel brackets={false} variant="flat" className="p-6 h-32 flex items-center justify-center">
          <span className="hud-label text-fg-muted">No brackets</span>
        </Panel>
        <Panel glow="magenta" bracketColor="var(--color-hud-magenta)" className="p-6 h-32 flex items-center justify-center">
          <span className="hud-label text-hud-magenta">Magenta</span>
        </Panel>
      </div>

      {/* Toggles & Sliders */}
      <Panel className="p-6">
        <div className="hud-label text-fg-muted mb-4">Toggles & Sliders</div>
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-8">
            <Toggle checked={tog1} onChange={setTog1} label="Audio" />
            <Toggle checked={tog2} onChange={setTog2} label="Watermark" />
            <Toggle checked={tog1} onChange={setTog1} label="Camera Lock" size="sm" />
            <Toggle checked={false} onChange={() => {}} label="Disabled" disabled />
          </div>
          <div className="grid grid-cols-2 gap-8">
            <Slider
              label="Duration"
              unit="s"
              value={duration}
              onChange={setDuration}
              min={4}
              max={15}
              ticks={[4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]}
            />
            <Slider
              label="Quality"
              value={duration}
              onChange={setDuration}
              min={0}
              max={100}
              step={5}
            />
          </div>
        </div>
      </Panel>

      {/* Status badges */}
      <Panel className="p-6">
        <div className="hud-label text-fg-muted mb-4">Status</div>
        <div className="flex flex-wrap gap-3 items-center">
          <StatusBadge status="idle" />
          <StatusBadge status="pending" />
          <StatusBadge status="processing" />
          <StatusBadge status="completed" />
          <StatusBadge status="failed" />
          <span className="ml-4 hud-label text-fg-dim">Custom →</span>
          <StatusBadge status="processing" label="Polling 47%" />
        </div>
      </Panel>

      {/* Inputs */}
      <Panel className="p-6">
        <div className="hud-label text-fg-muted mb-4">Inputs</div>
        <div className="grid grid-cols-2 gap-6">
          <HudInput label="Display Name" value={text} onChange={(e) => setText(e.target.value)} placeholder="Jane the Pilot" />
          <HudInput label="Tag" mono value={text} onChange={(e) => setText(e.target.value)} placeholder="@jane" hint="Lowercase, alphanumeric, underscores." />
          <HudInput label="With Error" error="Tag must be unique." value="@jane" onChange={() => {}} />
          <HudInput label="API Key" type="password" mono placeholder="•••••••••••" />
        </div>
      </Panel>

      {/* Loaders */}
      <Panel className="p-6">
        <div className="hud-label text-fg-muted mb-4">Loaders</div>
        <div className="flex flex-wrap items-center gap-10">
          <div className="flex flex-col items-center gap-2">
            <HudReticle />
            <span className="hud-label text-fg-dim">Reticle</span>
          </div>
          <div className="flex flex-col gap-2 w-64">
            <span className="hud-label text-fg-dim">Scan bar</span>
            <div className="hud-scan-bar h-1 bg-bg-elevated border border-border-hud" />
          </div>
          <div className="flex flex-col gap-2">
            <span className="hud-label text-fg-dim">Pulse dots</span>
            <div className="flex gap-1.5">
              {[0, 0.2, 0.4].map((d) => (
                <span
                  key={d}
                  className="w-1.5 h-1.5 bg-hud-cyan hud-pulse"
                  style={{ animationDelay: `${d}s` }}
                />
              ))}
            </div>
          </div>
        </div>
      </Panel>

      {/* Scanlines + warning */}
      <Panel className="relative p-6 overflow-hidden" glow="amber" bracketColor="var(--color-hud-amber)">
        <ScanlineOverlay intensity="medium" />
        <div className="relative flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-hud-amber flex-shrink-0 mt-0.5" />
          <div>
            <div className="hud-label text-hud-amber mb-1">Warning Surface</div>
            <p className="font-mono text-xs text-fg">
              Used for: realistic-face uploads, billing alerts, destructive operations.
            </p>
          </div>
        </div>
      </Panel>
    </div>
  );
}
