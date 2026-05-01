import { useEffect, useMemo, useState } from "react";
import { Plus, Search, Boxes, X } from "lucide-react";
import { Button, Panel, Select } from "@/components/hud";
import { ElementCard } from "@/components/elements/ElementCard";
import { ElementUploader } from "@/components/elements/ElementUploader";
import { ElementDetailModal } from "@/components/elements/ElementDetailModal";
import {
  ELEMENT_TYPES,
  ELEMENT_TYPE_META,
  type ElementType,
} from "@/lib/elementTypes";
import { useElements, type Element } from "@/stores/elementsStore";
import { isTauri } from "@/lib/tauri";

type Filter = ElementType | "all";

export function Elements() {
  const items = useElements((s) => s.items);
  const loaded = useElements((s) => s.loaded);
  const load = useElements((s) => s.load);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [creating, setCreating] = useState(false);
  const [active, setActive] = useState<Element | null>(null);

  useEffect(() => {
    if (!loaded) {
      void load();
    }
  }, [loaded, load]);

  const filtered = useMemo(() => {
    return items.filter((el) => {
      if (filter !== "all" && el.type !== filter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          el.tag.toLowerCase().includes(q) ||
          el.display_name.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [items, filter, search]);

  const filterOptions = [
    { value: "all", label: "All Types", color: "var(--color-fg)" },
    ...ELEMENT_TYPES.map((t) => ({
      value: t,
      label: ELEMENT_TYPE_META[t].label,
      color: ELEMENT_TYPE_META[t].color,
    })),
  ];

  return (
    <div className="p-8 max-w-[1600px] mx-auto">
      <header className="mb-6 flex items-end justify-between gap-4">
        <div>
          <div className="hud-label text-fg-dim mb-1">// Reference Library</div>
          <h1 className="font-mono text-2xl uppercase tracking-[0.08em] text-fg hud-text-glow-cyan">
            Elements
          </h1>
          <div className="font-mono text-xs text-fg-muted mt-2">
            {items.length} registered
            {filter !== "all" || search ? ` · ${filtered.length} shown` : ""}
          </div>
        </div>
        <Button
          iconLeft={<Plus className="w-4 h-4" />}
          onClick={() => setCreating(true)}
          disabled={!isTauri}
        >
          New Element
        </Button>
      </header>

      {!isTauri && (
        <div className="mb-4 border border-hud-amber/40 bg-hud-amber/5 px-4 py-3">
          <div className="hud-label text-hud-amber mb-1">Preview Mode</div>
          <p className="font-mono text-[0.7rem] text-fg-muted">
            Element creation, editing and image storage require the Tauri runtime.
            Run <span className="text-hud-cyan">npm run tauri dev</span> to use the full app.
          </p>
        </div>
      )}

      {/* Filter bar */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-dim pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or @tag..."
            className="w-full bg-bg-elevated/60 border border-border-hud pl-10 pr-9 py-2.5 text-sm text-fg placeholder:text-fg-dim hud-focus focus:border-hud-cyan transition-colors"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-dim hover:text-fg-muted"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="w-48">
          <Select
            value={filter}
            onChange={(v) => setFilter(v as Filter)}
            options={filterOptions}
          />
        </div>
      </div>

      {/* Grid or empty */}
      {!loaded ? (
        <Panel className="p-16 hud-grid-bg">
          <div className="flex justify-center">
            <span className="hud-label text-fg-muted hud-pulse">Loading library...</span>
          </div>
        </Panel>
      ) : items.length === 0 ? (
        <Panel className="p-16 hud-grid-bg">
          <div className="flex flex-col items-center justify-center text-center gap-4">
            <div className="relative w-16 h-16 border border-border-hud flex items-center justify-center">
              <Boxes className="w-7 h-7 text-fg-dim" strokeWidth={1.2} />
            </div>
            <div className="space-y-1">
              <h2 className="font-mono uppercase tracking-[0.15em] text-fg">
                Library Empty
              </h2>
              <p className="font-mono text-xs text-fg-muted max-w-md">
                Register reusable references — characters, props, locations, styles. Tag them with @handles and reuse across generations.
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setCreating(true)}
              disabled={!isTauri}
            >
              Register First Element
            </Button>
          </div>
        </Panel>
      ) : filtered.length === 0 ? (
        <Panel className="p-12">
          <div className="text-center font-mono text-xs text-fg-muted">
            No elements match your filter.
          </div>
        </Panel>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filtered.map((el) => (
            <ElementCard key={el.id} element={el} onClick={setActive} />
          ))}
        </div>
      )}

      <ElementUploader open={creating} onClose={() => setCreating(false)} />
      <ElementDetailModal element={active} onClose={() => setActive(null)} />
    </div>
  );
}
