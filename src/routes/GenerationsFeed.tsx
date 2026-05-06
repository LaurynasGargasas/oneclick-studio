import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Film, Plus, Settings2, Search, X } from "lucide-react";
import { Button, Panel } from "@/components/hud";
import { GenerationCard } from "@/components/generations/GenerationCard";
import { GenerationDetailModal } from "@/components/generations/GenerationDetailModal";
import { useGenerations, type Generation, type GenerationStatus } from "@/stores/generationsStore";
import { useSettings } from "@/stores/settingsStore";
import { cn } from "@/lib/cn";

type FilterTab = "all" | GenerationStatus;

const TABS: { value: FilterTab; label: string }[] = [
  { value: "all", label: "All" },
  { value: "processing", label: "Rendering" },
  { value: "pending", label: "Queued" },
  { value: "completed", label: "Completed" },
  { value: "failed", label: "Failed" },
];

export function GenerationsFeed() {
  const navigate = useNavigate();
  const items = useGenerations((s) => s.items);
  const loaded = useGenerations((s) => s.loaded);
  const load = useGenerations((s) => s.load);
  const startPolling = useGenerations((s) => s.startPolling);
  const pollingIds = useGenerations((s) => s.pollingIds);
  const remove = useGenerations((s) => s.remove);
  const settings = useSettings();

  const [active, setActive] = useState<Generation | null>(null);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<FilterTab>("all");

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

  // Counts per tab (for badges)
  const counts = useMemo(() => {
    const c: Record<FilterTab, number> = { all: items.length, processing: 0, pending: 0, completed: 0, failed: 0 };
    for (const g of items) c[g.status] = (c[g.status] ?? 0) + 1;
    return c;
  }, [items]);

  // Filtered + searched list
  const visible = useMemo(() => {
    let list = tab === "all" ? items : items.filter((g) => g.status === tab);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((g) => g.prompt_raw.toLowerCase().includes(q));
    }
    return list;
  }, [items, tab, search]);

  const hasAny = items.length > 0;

  return (
    <div className="p-8 max-w-[1600px] mx-auto">
      {/* Header */}
      <header className="mb-6 flex items-end justify-between">
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

      {/* Search + filter bar — only shown when there are generations */}
      {loaded && hasAny && (
        <div className="mb-5 flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative sm:w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-fg-dim pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search prompts…"
              className="w-full bg-bg-elevated/60 border border-border-hud pl-8 pr-8 py-2 font-mono text-xs text-fg placeholder:text-fg-dim focus:outline-none focus:border-hud-cyan transition-colors"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-fg-dim hover:text-fg transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Status tabs */}
          <div className="flex items-center gap-1">
            {TABS.map(({ value, label }) => {
              const count = counts[value];
              if (value !== "all" && count === 0) return null;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTab(value)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-2 border font-mono text-[0.65rem] uppercase tracking-[0.1em] transition-all",
                    tab === value
                      ? "border-hud-cyan bg-hud-cyan/10 text-hud-cyan"
                      : "border-border-hud text-fg-muted hover:border-border-hud hover:text-fg",
                  )}
                >
                  {label}
                  <span className={cn(
                    "tabular-nums text-[0.55rem]",
                    tab === value ? "text-hud-cyan/70" : "text-fg-dim",
                  )}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Loading */}
      {!loaded ? (
        <Panel className="p-16 hud-grid-bg">
          <div className="flex justify-center">
            <span className="hud-label text-fg-muted hud-pulse">Loading generations…</span>
          </div>
        </Panel>
      ) : !hasAny ? (
        /* Empty state — no generations at all */
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
            {!settings.apiKey ? (
              <div className="flex flex-col items-center gap-3 mt-2 border border-hud-amber/40 bg-hud-amber/5 px-6 py-4 max-w-sm">
                <p className="font-mono text-xs text-hud-amber">
                  No API key configured — set one in Settings to start generating.
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  iconLeft={<Settings2 className="w-3.5 h-3.5" />}
                  onClick={() => navigate("/settings")}
                >
                  Open Settings
                </Button>
              </div>
            ) : (
              <Button variant="secondary" size="sm" onClick={() => navigate("/generate")}>
                Begin Generation
              </Button>
            )}
          </div>
        </Panel>
      ) : visible.length === 0 ? (
        /* Empty search/filter result */
        <Panel className="p-10 hud-grid-bg" glow="none">
          <div className="flex flex-col items-center gap-3 text-center">
            <Search className="w-8 h-8 text-fg-dim" strokeWidth={1.2} />
            <p className="font-mono text-xs text-fg-muted">
              No generations match{search ? ` "${search}"` : " this filter"}.
            </p>
            <button
              type="button"
              className="font-mono text-[0.65rem] text-hud-cyan hover:underline"
              onClick={() => { setSearch(""); setTab("all"); }}
            >
              Clear filters
            </button>
          </div>
        </Panel>
      ) : (
        /* Live grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {visible.map((gen) => (
            <GenerationCard
              key={gen.id}
              generation={gen}
              onClick={() => setActive(gen)}
              onDelete={() => {
                if (active?.id === gen.id) setActive(null);
                void remove(gen.id);
              }}
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
