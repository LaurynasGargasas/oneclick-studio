import { useEffect, useState } from "react";
import { Plus, Folder } from "lucide-react";
import { Button, Panel } from "@/components/hud";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { ProjectFormModal } from "@/components/projects/ProjectFormModal";
import { useProjects } from "@/stores/projectsStore";
import { isTauri } from "@/lib/tauri";

export function Projects() {
  const items = useProjects((s) => s.items);
  const loaded = useProjects((s) => s.loaded);
  const load = useProjects((s) => s.load);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!loaded) void load();
  }, [loaded, load]);

  return (
    <div className="p-8 max-w-[1600px] mx-auto">
      <header className="mb-6 flex items-end justify-between">
        <div>
          <div className="hud-label text-fg-dim mb-1">// Workspaces</div>
          <h1 className="font-mono text-2xl uppercase tracking-[0.08em] text-fg hud-text-glow-cyan">
            Projects
          </h1>
          <div className="font-mono text-xs text-fg-muted mt-2">
            {items.length} {items.length === 1 ? "workspace" : "workspaces"}
          </div>
        </div>
        <Button
          iconLeft={<Plus className="w-4 h-4" />}
          onClick={() => setCreating(true)}
          disabled={!isTauri}
        >
          New Project
        </Button>
      </header>

      {!isTauri && (
        <div className="mb-4 border border-hud-amber/40 bg-hud-amber/5 px-4 py-3">
          <div className="hud-label text-hud-amber mb-1">Preview Mode</div>
          <p className="font-mono text-[0.7rem] text-fg-muted">
            Project creation requires the Tauri runtime. Run{" "}
            <span className="text-hud-cyan">npm run tauri dev</span> for full
            functionality.
          </p>
        </div>
      )}

      {!loaded ? (
        <Panel className="p-16 hud-grid-bg">
          <div className="flex justify-center">
            <span className="hud-label text-fg-muted hud-pulse">
              Loading projects...
            </span>
          </div>
        </Panel>
      ) : items.length === 0 ? (
        <Panel className="p-16 hud-grid-bg">
          <div className="flex flex-col items-center justify-center text-center gap-4">
            <div className="relative w-16 h-16 border border-border-hud flex items-center justify-center">
              <Folder className="w-7 h-7 text-fg-dim" strokeWidth={1.2} />
            </div>
            <div className="space-y-1">
              <h2 className="font-mono uppercase tracking-[0.15em] text-fg">
                No Projects Yet
              </h2>
              <p className="font-mono text-xs text-fg-muted max-w-md">
                Group related generations into projects. Each gets its own
                accent color and acts as a filter for the feed.
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setCreating(true)}
              disabled={!isTauri}
            >
              Create First Project
            </Button>
          </div>
        </Panel>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {items.map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
        </div>
      )}

      <ProjectFormModal open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}
