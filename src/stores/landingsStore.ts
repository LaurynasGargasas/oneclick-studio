import { create } from "zustand";
import { invoke, isTauri } from "@/lib/tauri";
import { getDb } from "@/lib/db";
import type { LandingDocument } from "@/lib/landingTypes";
import { PRESETS } from "@/components/landing/presets";

export interface LandingPageRow {
  id: string;
  name: string;
  preset_id: string;
  doc_json: string;          // serialized LandingDocument
  starred: number;           // 0 | 1
  created_at: number;
  updated_at: number;
}

export interface LandingPage {
  id: string;
  name: string;
  preset_id: string;
  doc: LandingDocument;
  starred: boolean;
  created_at: number;
  updated_at: number;
}

export interface LandingCreateInput {
  name: string;
  preset_id: string;
  doc: LandingDocument;
}

type LandingPatch = Partial<{
  name: string;
  doc: LandingDocument;
}>;

// Parse + heal a doc_json row.  Older rows (pre-pivot) used a `sections`
// array; we replace those with an empty html doc since they're not
// meaningfully convertible.  Modern rows already have `html`.
function parseDoc(raw: string, presetId: string): LandingDocument {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = {};
  }
  const doc: LandingDocument = (
    parsed && typeof parsed === "object" && "html" in (parsed as object)
      ? (parsed as LandingDocument)
      : { html: "" }
  );
  if (typeof doc.html !== "string") doc.html = "";
  if (!doc.meta?.css_family) {
    const preset = PRESETS.find((p) => p.id === presetId);
    if (preset?.css_family) {
      doc.meta = { ...(doc.meta ?? {}), css_family: preset.css_family };
    }
  }
  return doc;
}

function rowToLanding(row: LandingPageRow): LandingPage {
  return {
    id: row.id,
    name: row.name,
    preset_id: row.preset_id,
    doc: parseDoc(row.doc_json, row.preset_id),
    starred: !!row.starred,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

interface LandingsState {
  items: LandingPage[];
  loaded: boolean;
  error: string | null;

  load: () => Promise<void>;
  get: (id: string) => LandingPage | undefined;

  create: (data: LandingCreateInput) => Promise<LandingPage>;
  update: (id: string, patch: LandingPatch) => Promise<void>;
  remove: (id: string) => Promise<void>;
  setStarred: (id: string, starred: boolean) => Promise<void>;
  duplicate: (id: string) => Promise<LandingPage | null>;
}

export const useLandings = create<LandingsState>((set, get) => ({
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
      const rows = await db.select<LandingPageRow[]>(
        "SELECT * FROM landing_pages ORDER BY starred DESC, updated_at DESC",
      );
      set({ items: rows.map(rowToLanding), loaded: true, error: null });
    } catch (err) {
      console.error("Failed to load landing pages:", err);
      set({ loaded: true, error: String(err) });
    }
  },

  get(id) {
    return get().items.find((l) => l.id === id);
  },

  async create(data) {
    if (!isTauri) {
      throw new Error("Landing creation requires the Tauri runtime");
    }
    const id = await invoke<string>("new_uuid");
    const now = Date.now();
    const docJson = JSON.stringify(data.doc);
    const db = await getDb();
    await db.execute(
      `INSERT INTO landing_pages
         (id, name, preset_id, doc_json, starred, created_at, updated_at)
       VALUES (?, ?, ?, ?, 0, ?, ?)`,
      [id, data.name, data.preset_id, docJson, now, now],
    );
    const landing: LandingPage = {
      id,
      name: data.name,
      preset_id: data.preset_id,
      doc: data.doc,
      starred: false,
      created_at: now,
      updated_at: now,
    };
    set((state) => ({ items: [landing, ...state.items] }));
    return landing;
  },

  async update(id, patch) {
    if (!isTauri) return;
    const fields: string[] = [];
    const values: unknown[] = [];
    if (patch.name !== undefined) {
      fields.push("name = ?");
      values.push(patch.name);
    }
    if (patch.doc !== undefined) {
      fields.push("doc_json = ?");
      values.push(JSON.stringify(patch.doc));
    }
    if (fields.length === 0) return;
    const now = Date.now();
    fields.push("updated_at = ?");
    values.push(now);
    const db = await getDb();
    await db.execute(
      `UPDATE landing_pages SET ${fields.join(", ")} WHERE id = ?`,
      [...values, id],
    );
    set((state) => ({
      items: state.items.map((l) =>
        l.id === id
          ? {
              ...l,
              ...(patch.name !== undefined ? { name: patch.name } : {}),
              ...(patch.doc !== undefined ? { doc: patch.doc } : {}),
              updated_at: now,
            }
          : l,
      ),
    }));
  },

  async remove(id) {
    if (!isTauri) return;
    const db = await getDb();
    await db.execute("DELETE FROM landing_pages WHERE id = ?", [id]);
    set((state) => ({ items: state.items.filter((l) => l.id !== id) }));
  },

  async setStarred(id, starred) {
    if (!isTauri) return;
    const db = await getDb();
    await db.execute(
      "UPDATE landing_pages SET starred = ? WHERE id = ?",
      [starred ? 1 : 0, id],
    );
    set((state) => {
      const items = state.items
        .map((l) => (l.id === id ? { ...l, starred } : l))
        .sort((a, b) => {
          if (a.starred !== b.starred) return a.starred ? -1 : 1;
          return b.updated_at - a.updated_at;
        });
      return { items };
    });
  },

  async duplicate(id) {
    if (!isTauri) return null;
    const original = get().items.find((l) => l.id === id);
    if (!original) return null;
    const newId = await invoke<string>("new_uuid");
    const now = Date.now();
    const newDoc: LandingDocument = JSON.parse(
      JSON.stringify(original.doc),
    ) as LandingDocument;
    const newName = `${original.name} (copy)`;
    const docJson = JSON.stringify(newDoc);
    const db = await getDb();
    await db.execute(
      `INSERT INTO landing_pages
         (id, name, preset_id, doc_json, starred, created_at, updated_at)
       VALUES (?, ?, ?, ?, 0, ?, ?)`,
      [newId, newName, original.preset_id, docJson, now, now],
    );
    const landing: LandingPage = {
      id: newId,
      name: newName,
      preset_id: original.preset_id,
      doc: newDoc,
      starred: false,
      created_at: now,
      updated_at: now,
    };
    set((state) => ({ items: [landing, ...state.items] }));
    return landing;
  },
}));
