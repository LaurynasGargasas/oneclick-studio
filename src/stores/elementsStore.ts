import { create } from "zustand";
import { invoke, isTauri } from "@/lib/tauri";
import { getDb } from "@/lib/db";
import type { ElementType } from "@/lib/elementTypes";

export interface ElementImage {
  id: string;
  element_id: string;
  file_path: string;
  sort_order: number;
  width: number | null;
  height: number | null;
  created_at: number;
}

export interface Element {
  id: string;
  tag: string;
  display_name: string;
  type: ElementType;
  description: string | null;
  thumbnail: string | null;
  created_at: number;
  updated_at: number;
  images: ElementImage[];
}

export interface PendingImage {
  data_url: string;
  original_name: string;
}

export interface ElementCreateInput {
  tag: string;
  display_name: string;
  type: ElementType;
  description: string | null;
}

interface SavedImagePayload {
  id: string;
  elementId: string;
  filePath: string;
  sortOrder: number;
  width: number | null;
  height: number | null;
  createdAt: number;
}

interface ElementRow {
  id: string;
  tag: string;
  display_name: string;
  type: ElementType;
  description: string | null;
  thumbnail: string | null;
  created_at: number;
  updated_at: number;
}

interface ImageRow {
  id: string;
  element_id: string;
  file_path: string;
  sort_order: number;
  width: number | null;
  height: number | null;
  created_at: number;
}

interface ElementsState {
  items: Element[];
  loaded: boolean;
  error: string | null;
  load: () => Promise<void>;
  create: (data: ElementCreateInput, images: PendingImage[]) => Promise<Element>;
  update: (
    id: string,
    patch: Partial<Pick<Element, "tag" | "display_name" | "type" | "description">>,
  ) => Promise<void>;
  remove: (id: string) => Promise<void>;
  appendImage: (elementId: string, image: PendingImage) => Promise<ElementImage>;
  removeImage: (elementId: string, imageId: string) => Promise<void>;
}

const fromSavedPayload = (s: SavedImagePayload): ElementImage => ({
  id: s.id,
  element_id: s.elementId,
  file_path: s.filePath,
  sort_order: s.sortOrder,
  width: s.width,
  height: s.height,
  created_at: s.createdAt,
});

export const useElements = create<ElementsState>((set, get) => ({
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
      const elementRows = await db.select<ElementRow[]>(
        "SELECT * FROM elements ORDER BY updated_at DESC",
      );
      const imageRows = await db.select<ImageRow[]>(
        "SELECT * FROM element_images ORDER BY element_id, sort_order",
      );
      const byElement: Record<string, ElementImage[]> = {};
      for (const img of imageRows) {
        (byElement[img.element_id] ||= []).push(img);
      }
      const items: Element[] = elementRows.map((row) => ({
        ...row,
        images: byElement[row.id] || [],
      }));
      set({ items, loaded: true, error: null });
    } catch (err) {
      console.error("Failed to load elements:", err);
      set({ loaded: true, error: String(err) });
    }
  },

  async create(data, images) {
    if (!isTauri) {
      throw new Error("Element creation requires the Tauri runtime");
    }
    const elementId = await invoke<string>("new_uuid");

    const savedImages: ElementImage[] =
      images.length > 0
        ? (
            await invoke<SavedImagePayload[]>("save_new_element_images", {
              elementId,
              images: images.map((img) => ({
                dataUrl: img.data_url,
                originalName: img.original_name,
              })),
            })
          ).map(fromSavedPayload)
        : [];

    const now = Date.now();
    const thumbnail = savedImages[0]?.file_path ?? null;

    const db = await getDb();
    await db.execute(
      `INSERT INTO elements (id, tag, display_name, type, description, thumbnail, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        elementId,
        data.tag,
        data.display_name,
        data.type,
        data.description,
        thumbnail,
        now,
        now,
      ],
    );

    for (const img of savedImages) {
      await db.execute(
        `INSERT INTO element_images (id, element_id, file_path, sort_order, width, height, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          img.id,
          elementId,
          img.file_path,
          img.sort_order,
          img.width,
          img.height,
          img.created_at,
        ],
      );
    }

    const newElement: Element = {
      id: elementId,
      tag: data.tag,
      display_name: data.display_name,
      type: data.type,
      description: data.description,
      thumbnail,
      created_at: now,
      updated_at: now,
      images: savedImages,
    };

    set((state) => ({ items: [newElement, ...state.items] }));
    return newElement;
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
      `UPDATE elements SET ${setClause}, updated_at = ? WHERE id = ?`,
      [...values, now, id],
    );

    set((state) => ({
      items: state.items.map((e) =>
        e.id === id ? { ...e, ...patch, updated_at: now } : e,
      ),
    }));
  },

  async remove(id) {
    if (!isTauri) return;
    const db = await getDb();
    await db.execute("DELETE FROM elements WHERE id = ?", [id]);
    await invoke("delete_element_dir", { elementId: id });
    set((state) => ({ items: state.items.filter((e) => e.id !== id) }));
  },

  async appendImage(elementId, image) {
    if (!isTauri) {
      throw new Error("Image upload requires the Tauri runtime");
    }
    const current = get().items.find((e) => e.id === elementId);
    const sortOrder = current ? current.images.length : 0;

    const savedRaw = await invoke<SavedImagePayload>("append_element_image", {
      elementId,
      image: { dataUrl: image.data_url, originalName: image.original_name },
      sortOrder,
    });
    const saved = fromSavedPayload(savedRaw);

    const db = await getDb();
    await db.execute(
      `INSERT INTO element_images (id, element_id, file_path, sort_order, width, height, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        saved.id,
        saved.element_id,
        saved.file_path,
        saved.sort_order,
        saved.width,
        saved.height,
        saved.created_at,
      ],
    );

    const updateThumb = sortOrder === 0;
    const now = Date.now();
    if (updateThumb) {
      await db.execute(
        "UPDATE elements SET thumbnail = ?, updated_at = ? WHERE id = ?",
        [saved.file_path, now, elementId],
      );
    }

    set((state) => ({
      items: state.items.map((e) =>
        e.id === elementId
          ? {
              ...e,
              images: [...e.images, saved],
              thumbnail: updateThumb ? saved.file_path : e.thumbnail,
              updated_at: updateThumb ? now : e.updated_at,
            }
          : e,
      ),
    }));

    return saved;
  },

  async removeImage(elementId, imageId) {
    if (!isTauri) return;
    const current = get().items.find((e) => e.id === elementId);
    const img = current?.images.find((i) => i.id === imageId);
    if (!current || !img) return;

    const db = await getDb();
    await db.execute("DELETE FROM element_images WHERE id = ?", [imageId]);
    await invoke("delete_image_file", { filePath: img.file_path });

    const remaining = current.images.filter((i) => i.id !== imageId);

    let newThumbnail = current.thumbnail;
    let updatedAt = current.updated_at;
    if (current.thumbnail === img.file_path) {
      newThumbnail = remaining[0]?.file_path ?? null;
      updatedAt = Date.now();
      await db.execute(
        "UPDATE elements SET thumbnail = ?, updated_at = ? WHERE id = ?",
        [newThumbnail, updatedAt, elementId],
      );
    }

    set((state) => ({
      items: state.items.map((e) =>
        e.id === elementId
          ? {
              ...e,
              images: remaining,
              thumbnail: newThumbnail,
              updated_at: updatedAt,
            }
          : e,
      ),
    }));
  },
}));
