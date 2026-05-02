import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Film, Plus } from "lucide-react";
import { Button, Panel } from "@/components/hud";
import { GenerationCard } from "@/components/generations/GenerationCard";
import { GenerationDetailModal } from "@/components/generations/GenerationDetailModal";
import { useGenerations, type Generation } from "@/stores/generationsStore";
import { useSettings } from "@/stores/settingsStore";

export function GenerationsFeed() {
  const navigate = useNavigate();
  const items = useGenerations((s) => s.items);
  const loaded = useGenerations((s) => s.loaded);
  const load = useGenerations((s) => s.load);
  const startPolling = useGenerations((s) => s.startPolling);
  const pollingIds = useGenerations((s) => s.pollingIds);
  const settings = useSettings();

  const [active, setActive] = useState<Generation | null>(null);

  // Load generations from DB on mount
  useEffect(() => {
    if (!loaded) void load();
  }, [loaded, load]);

  // Resume polling for any in-flight generations after page load
  useEffect(() => {
    if (!loaded || !settings.apiKey) return;
    const api = {
      endpoint: settings.apiEndpoint,
      api_key: settings.apiKey,
    };
    for (const gen of items) {
      if (
        (gen.status === "processing" || gen.status === "pending") &&
        gen.task_id &&
        !pollingIds.has(gen.id)
      ) {
        startPolling(gen.id, api);
      }
    }
  }, [loaded, items, settings, startPolling, pollingIds]);

  // Keep detail modal in sync if its generation updates
  useEffect(() => {
    if (!active) return;
    const updated = items.find((g) => g.id === active.id);
    if (updated) setActive(updated);
  }, [items, active]);

  return (
    <div className="p-8 max-w-[1600px] mx-auto">
      {/* Header */}
      <header className="mb-8 flex items-end justify-between">
        <div>
          <div className="hud-label text-fg-dim mb-1">// Live Feed</div>
          <h1 className="font-mono text-2xl uppercase tracking-[0.08em] text-fg hud-text-glow-cyan">
            Generations
          </h1>
          {loaded && (
            <div className="font-mono text-xs text-fg-muted mt-2">
              {items.length} {items.length === 1 ? "generation" : "generations"}
              {pollingIds.size > 0 && (
                <span className="ml-2 text-hud-amber hud-pulse">
                  · {pollingIds.size} rendering
                </span>
              )}
            </div>
          )}
        </div>
        <Button
          iconLeft={<Plus className="w-4 h-4" />}
          onClick={() => navigate("/generate")}
        >
          New Generation
        </Button>
      </header>

      {/* Loading */}
      {!loaded ? (
        <Panel className="p-16 hud-grid-bg">
          <div className="flex justify-center">
            <span className="hud-label text-fg-muted hud-pulse">Loading generations…</span>
          </div>
        </Panel>
      ) : items.length === 0 ? (
        /* Empty state */
        <Panel className="p-16 hud-grid-bg" glow="none">
          <div className="flex flex-col items-center justify-center text-center gap-4">
            <div className="relative w-16 h-16 border border-border-hud flex items-center justify-center">
              <Film className="w-7 h-7 text-fg-dim" strokeWidth={1.2} />
            </div>
            <div className="space-y-1">
              <h2 className="font-mono uppercase tracking-[0.15em] text-fg">No Generations Yet</h2>
              <p className="font-mono text-xs text-fg-muted max-w-md">
                Compose a prompt with elements, set parameters, and submit your first generation.
                Results stream in here as they complete.
              </p>
            </div>
            <Button variant="secondary" size="sm" onClick={() => navigate("/generate")}>
              Begin Generation
            </Button>
          </div>
        </Panel>
      ) : (
        /* Live grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {items.map((gen) => (
            <GenerationCard
              key={gen.id}
              generation={gen}
              onClick={() => setActive(gen)}
            />
          ))}
        </div>
      )}

      <GenerationDetailModal
        generation={active}
        onClose={() => setActive(null)}
      />
    </div>
  );
}
