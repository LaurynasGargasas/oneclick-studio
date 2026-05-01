import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Plus, Trash2, Edit2, Check, X } from "lucide-react";
import { Button, Panel } from "@/components/hud";
import { ProjectFormModal } from "@/components/projects/ProjectFormModal";
import { useProjects } from "@/stores/projectsStore";
import { withAlpha } from "@/lib/projectColors";

export function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const project = useProjects((s) => s.items.find((p) => p.id === id));
  const update = useProjects((s) => s.update);
  const remove = useProjects((s) => s.remove);
  const loaded = useProjects((s) => s.loaded);
  const load = useProjects((s) => s.load);

  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [tempName, setTempName] = useState("");
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!loaded) void load();
  }, [loaded, load]);

  useEffect(() => {
    if (editingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [editingName]);

  if (loaded && !project) {
    return (
      <div className="p-8 max-w-[1600px] mx-auto">
        <Link
          to="/projects"
          className="inline-flex items-center gap-2 mb-6 font-mono text-[0.7rem] uppercase tracking-[0.15em] text-fg-muted hover:text-hud-cyan transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Projects
        </Link>
        <Panel className="p-12 text-center">
          <div className="hud-label text-hud-red mb-2">// Not Found</div>
          <p className="font-mono text-xs text-fg-muted">
            No project found with that ID.
          </p>
        </Panel>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="p-8 flex justify-center">
        <span className="hud-label text-fg-muted hud-pulse">Loading...</span>
      </div>
    );
  }

  const accent = project.color_accent;

  function startEditName() {
    if (!project) return;
    setTempName(project.name);
    setEditingName(true);
  }

  async function saveName() {
    if (!project) return;
    const trimmed = tempName.trim();
    if (trimmed && trimmed !== project.name) {
      await update(project.id, { name: trimmed });
    }
    setEditingName(false);
  }

  async function handleDelete() {
    if (!project) return;
    await remove(project.id);
    navigate("/projects");
  }

  return (
    <div className="p-8 max-w-[1600px] mx-auto">
      <Link
        to="/projects"
        className="inline-flex items-center gap-2 mb-6 font-mono text-[0.7rem] uppercase tracking-[0.15em] text-fg-muted hover:text-hud-cyan transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to Projects
      </Link>

      <header className="mb-8">
        <div className="hud-label mb-2" style={{ color: accent }}>
          // Workspace
        </div>

        {editingName ? (
          <input
            ref={nameInputRef}
            type="text"
            value={tempName}
            onChange={(e) => setTempName(e.target.value)}
            onBlur={saveName}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveName();
              if (e.key === "Escape") setEditingName(false);
            }}
            className="bg-bg-elevated/60 border-b-2 px-2 py-1 mb-3 font-mono text-2xl uppercase tracking-[0.08em] text-fg focus:outline-none"
            style={{ borderColor: accent }}
            maxLength={80}
          />
        ) : (
          <button
            type="button"
            onClick={startEditName}
            className="group flex items-center gap-3 mb-3 hud-focus"
          >
            <h1
              className="font-mono text-2xl uppercase tracking-[0.08em] text-fg"
              style={{
                textShadow: `0 0 8px ${withAlpha(accent, 0.6)}, 0 0 16px ${withAlpha(accent, 0.3)}`,
              }}
            >
              {project.name}
            </h1>
            <Edit2 className="w-3.5 h-3.5 text-fg-dim opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        )}

        {project.description && (
          <p className="font-mono text-xs text-fg-muted max-w-3xl leading-relaxed">
            {project.description}
          </p>
        )}

        <div className="flex items-center gap-5 mt-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span
              className="w-2 h-2"
              style={{
                backgroundColor: accent,
                boxShadow: `0 0 8px ${accent}`,
              }}
            />
            <span className="hud-label text-fg-dim">
              {accent.toUpperCase()}
            </span>
          </div>
          <span className="hud-label text-fg-dim">
            CREATED {new Date(project.created_at).toLocaleDateString()}
          </span>

          <div className="flex-1" />

          <Button
            variant="secondary"
            size="sm"
            iconLeft={<Edit2 className="w-3.5 h-3.5" />}
            onClick={() => setEditing(true)}
          >
            Edit
          </Button>
          {confirmDelete ? (
            <div className="flex items-center gap-2">
              <span className="hud-label text-hud-red">Delete project?</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirmDelete(false)}
              >
                <X className="w-3.5 h-3.5" />
              </Button>
              <Button variant="danger" size="sm" onClick={handleDelete}>
                <Check className="w-3.5 h-3.5" />
              </Button>
            </div>
          ) : (
            <Button
              variant="danger"
              size="sm"
              iconLeft={<Trash2 className="w-3.5 h-3.5" />}
              onClick={() => setConfirmDelete(true)}
            >
              Delete
            </Button>
          )}
          <Button
            variant="primary"
            iconLeft={<Plus className="w-4 h-4" />}
            onClick={() => navigate(`/generate?project=${project.id}`)}
          >
            New Generation
          </Button>
        </div>
      </header>

      {/* Generations placeholder — wired in Phase 6 */}
      <Panel
        className="p-16 hud-grid-bg"
        bracketColor={accent}
      >
        <div className="flex flex-col items-center justify-center text-center gap-4">
          <div
            className="relative w-16 h-16 border flex items-center justify-center"
            style={{ borderColor: withAlpha(accent, 0.4) }}
          >
            <Plus
              className="w-7 h-7"
              style={{ color: accent }}
              strokeWidth={1.2}
            />
          </div>
          <div className="space-y-1">
            <h2 className="font-mono uppercase tracking-[0.15em] text-fg">
              No Generations Yet
            </h2>
            <p className="font-mono text-xs text-fg-muted max-w-md">
              Compose your first generation for this project. Output will
              appear here as it completes.
            </p>
          </div>
        </div>
      </Panel>

      <ProjectFormModal
        open={editing}
        onClose={() => setEditing(false)}
        initial={{
          id: project.id,
          name: project.name,
          description: project.description,
          color_accent: project.color_accent,
        }}
      />
    </div>
  );
}
