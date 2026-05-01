import { create } from "zustand";
import { invoke, isTauri } from "@/lib/tauri";
import { getDb } from "@/lib/db";

export interface Project {
  id: string;
  name: string;
  description: string | null;
  cover_image: string | null;
  color_accent: string;
  created_at: number;
  updated_at: number;
}

export interface ProjectCreateInput {
  name: string;
  description: string | null;
  color_accent: string;
}

type ProjectPatch = Partial<
  Pick<Project, "name" | "description" | "color_accent" | "cover_image">
>;

interface ProjectsState {
  items: Project[];
  loaded: boolean;
  error: string | null;
  load: () => Promise<void>;
  create: (data: ProjectCreateInput) => Promise<Project>;
  update: (id: string, patch: ProjectPatch) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export const useProjects = create<ProjectsState>((set) => ({
  items: [],
  loaded: false,
  error: null,

  async load() {
    if (!isTauri) {
      set({ loaded: true });
      return;
    }
    try {
      const db = await getDb();
      const rows = await db.select<Project[]>(
        "SELECT * FROM projects ORDER BY updated_at DESC",
      );
      set({ items: rows, loaded: true, error: null });
    } catch (err) {
      console.error("Failed to load projects:", err);
      set({ loaded: true, error: String(err) });
    }
  },

  async create(data) {
    if (!isTauri) {
      throw new Error("Project creation requires the Tauri runtime");
    }
    const id = await invoke<string>("new_uuid");
    const now = Date.now();
    const project: Project = {
      id,
      name: data.name,
      description: data.description,
      cover_image: null,
      color_accent: data.color_accent,
      created_at: now,
      updated_at: now,
    };
    const db = await getDb();
    await db.execute(
      `INSERT INTO projects (id, name, description, cover_image, color_accent, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        project.id,
        project.name,
        project.description,
        project.cover_image,
        project.color_accent,
        project.created_at,
        project.updated_at,
      ],
    );
    set((state) => ({ items: [project, ...state.items] }));
    return project;
  },

  async update(id, patch) {
    if (!isTauri) return;
    const fields = Object.keys(patch);
    if (fields.length === 0) return;
    const now = Date.now();
    const setClause = fields.map((f) => `${f} = ?`).join(", ");
    const values = fields.map((f) => (patch as Record<string, unknown>)[f]);
    const db = await getDb();
    await db.execute(
      `UPDATE projects SET ${setClause}, updated_at = ? WHERE id = ?`,
      [...values, now, id],
    );
    set((state) => ({
      items: state.items.map((p) =>
        p.id === id ? { ...p, ...patch, updated_at: now } : p,
      ),
    }));
  },

  async remove(id) {
    if (!isTauri) return;
    const db = await getDb();
    await db.execute("DELETE FROM projects WHERE id = ?", [id]);
    set((state) => ({ items: state.items.filter((p) => p.id !== id) }));
  },
}));
