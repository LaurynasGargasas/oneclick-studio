// Store for user-saved landing-page presets.  Lives in SQLite alongside
// the landings themselves; surfaces in the PresetPicker beside the
// bundled built-ins.

import { create } from "zustand";
import { invoke, isTauri } from "@/lib/tauri";
import { getDb } from "@/lib/db";
import type { CssFamily } from "@/lib/landingTypes";

export interface UserPresetRow {
  id: string;
  name: string;
  description: string | null;
  css_family: string | null;
  html: string;
  thumbnail_src: string | null;
  created_at: number;
  updated_at: number;
}

export interface UserPreset {
  id: string;
  name: string;
  description: string | null;
  css_family: CssFamily;
  html: string;
  thumbnail_src: string | null;
  created_at: number;
  updated_at: number;
}

export interface UserPresetCreateInput {
  name: string;
  description: string | null;
  css_family: CssFamily;
  html: string;
  thumbnail_src: string | null;
}

function rowToPreset(row: UserPresetRow): UserPreset {
  return {
    ...row,
    css_family: (row.css_family ?? null) as CssFamily,
  };
}

interface UserPresetsState {
  items: UserPreset[];
  loaded: boolean;
  error: string | null;

  load: () => Promise<void>;
  create: (data: UserPresetCreateInput) => Promise<UserPreset>;
  remove: (id: string) => Promise<void>;
}

export const useUserPresets = create<UserPresetsState>((set) => ({
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
      const rows = await db.select<UserPresetRow[]>(
        "SELECT * FROM landing_presets ORDER BY updated_at DESC",
      );
      set({ items: rows.map(rowToPreset), loaded: true, error: null });
    } catch (err) {
      console.error("Failed to load user presets:", err);
      set({ loaded: true, error: String(err) });
    }
  },

  async create(data) {
    if (!isTauri) {
      throw new Error("Preset creation requires the Tauri runtime");
    }
    const id = await invoke<string>("new_uuid");
    const now = Date.now();
    const db = await getDb();
    await db.execute(
      `INSERT INTO landing_presets
         (id, name, description, css_family, html, thumbnail_src, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.name,
        data.description,
        data.css_family,
        data.html,
        data.thumbnail_src,
        now,
        now,
      ],
    );
    const preset: UserPreset = {
      id,
      name: data.name,
      description: data.description,
      css_family: data.css_family,
      html: data.html,
      thumbnail_src: data.thumbnail_src,
      created_at: now,
      updated_at: now,
    };
    set((s) => ({ items: [preset, ...s.items] }));
    return preset;
  },

  async remove(id) {
    if (!isTauri) return;
    const db = await getDb();
    await db.execute("DELETE FROM landing_presets WHERE id = ?", [id]);
    set((s) => ({ items: s.items.filter((p) => p.id !== id) }));
  },
}));
