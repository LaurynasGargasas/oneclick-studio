import { invoke } from "@tauri-apps/api/core";
import { create } from "zustand";
import { isTauri } from "@/lib/tauri";
import { getDb } from "@/lib/db";
import { resolvePrompt } from "@/lib/tagResolver";
import type { ContentItem } from "@/lib/tagResolver";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type GenerationStatus = "pending" | "processing" | "completed" | "failed";

export interface Generation {
  id: string;
  project_id: string | null;
  prompt_raw: string;
  prompt_resolved: string;
  duration_s: number;
  resolution: string;
  aspect_ratio: string;
  quality: string;
  seed: number | null;
  camera_fixed: boolean;
  watermark: boolean;
  audio_enabled: boolean;
  status: GenerationStatus;
  task_id: string | null;
  video_path: string | null;
  thumbnail_path: string | null;
  error_message: string | null;
  cost_credits: number | null;
  created_at: number;
  completed_at: number | null;
}

export interface SubmitOptions {
  prompt: string;
  project_id?: string | null;
  duration?: number;
  resolution?: string;
  aspect_ratio?: string;
  quality?: string;
  seed?: number | null;
  camera_fixed?: boolean;
  watermark?: boolean;
  audio_enabled?: boolean;
  /** Pass the elements store items for @tag resolution */
  elements: Array<{ tag: string; id: string; images: Array<{ file_path: string }> }>;
  /** API credentials from settings */
  api: { endpoint: string; api_key: string; model_id: string };
}

interface GenerationsState {
  items: Generation[];
  loaded: boolean;
  pollingIds: Set<string>;

  load: (projectId?: string | null) => Promise<void>;
  submit: (opts: SubmitOptions) => Promise<string>;
  poll: (generationId: string, api: { endpoint: string; api_key: string }) => Promise<void>;
  startPolling: (generationId: string, api: { endpoint: string; api_key: string }) => void;
  stopPolling: (generationId: string) => void;
  stopAllPolling: () => void;
  _updateLocal: (id: string, patch: Partial<Generation>) => void;
}

// ---------------------------------------------------------------------------
// DB helpers
// ---------------------------------------------------------------------------

interface GenerationRow {
  id: string;
  project_id: string | null;
  prompt_raw: string;
  prompt_resolved: string;
  duration_s: number;
  resolution: string;
  aspect_ratio: string;
  quality: string;
  seed: number | null;
  camera_fixed: number;
  watermark: number;
  audio_enabled: number;
  status: string;
  task_id: string | null;
  video_path: string | null;
  thumbnail_path: string | null;
  error_message: string | null;
  cost_credits: number | null;
  created_at: number;
  completed_at: number | null;
}

function rowToGeneration(r: GenerationRow): Generation {
  return {
    ...r,
    camera_fixed: Boolean(r.camera_fixed),
    watermark: Boolean(r.watermark),
    audio_enabled: Boolean(r.audio_enabled),
    status: r.status as GenerationStatus,
  };
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

// Holds active polling interval IDs, keyed by generation id.
const intervals = new Map<string, ReturnType<typeof setInterval>>();

export const useGenerations = create<GenerationsState>((set, get) => ({
  items: [],
  loaded: false,
  pollingIds: new Set(),

  // ---- load ----------------------------------------------------------------
  async load(projectId) {
    if (!isTauri) {
      set({ loaded: true });
      return;
    }
    const db = await getDb();
    const rows = projectId
      ? await db.select<GenerationRow[]>(
          "SELECT * FROM generations WHERE project_id = ? ORDER BY created_at DESC",
          [projectId],
        )
      : await db.select<GenerationRow[]>(
          "SELECT * FROM generations ORDER BY created_at DESC LIMIT 200",
        );
    set({ items: rows.map(rowToGeneration), loaded: true });
  },

  // ---- submit --------------------------------------------------------------
  async submit(opts) {
    const {
      prompt,
      project_id = null,
      duration = 5,
      resolution = "720p",
      aspect_ratio = "16:9",
      quality = "standard",
      seed = null,
      camera_fixed = false,
      watermark = false,
      audio_enabled = true,
      elements,
      api,
    } = opts;

    // Resolve @tags → content array
    const resolved = await resolvePrompt(prompt, elements);
    const content: ContentItem[] = resolved.content;
    const promptResolved = content
      .filter((c) => c.type === "text")
      .map((c) => c.text)
      .join(" ");

    const now = Date.now();
    const id: string = await invoke("new_uuid");

    // Persist as "pending" first so it appears in the feed immediately
    if (isTauri) {
      const db = await getDb();
      await db.execute(
        `INSERT INTO generations
          (id, project_id, prompt_raw, prompt_resolved, duration_s, resolution,
           aspect_ratio, quality, seed, camera_fixed, watermark, audio_enabled,
           status, task_id, video_path, thumbnail_path, error_message,
           cost_credits, created_at, completed_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          id,
          project_id,
          prompt,
          promptResolved,
          duration,
          resolution,
          aspect_ratio,
          quality,
          seed,
          camera_fixed ? 1 : 0,
          watermark ? 1 : 0,
          audio_enabled ? 1 : 0,
          "pending",
          null,
          null,
          null,
          null,
          null,
          now,
          null,
        ],
      );

      // Link resolved elements
      if (resolved.resolvedTags.length > 0) {
        const elemMap = new Map(elements.map((e) => [e.tag, e.id]));
        for (const tag of resolved.resolvedTags) {
          const elemId = elemMap.get(tag);
          if (elemId) {
            await db.execute(
              "INSERT OR IGNORE INTO generation_elements (generation_id, element_id) VALUES (?,?)",
              [id, elemId],
            );
          }
        }
      }
    }

    const newGen: Generation = {
      id,
      project_id,
      prompt_raw: prompt,
      prompt_resolved: promptResolved,
      duration_s: duration,
      resolution,
      aspect_ratio,
      quality,
      seed,
      camera_fixed,
      watermark,
      audio_enabled,
      status: "pending",
      task_id: null,
      video_path: null,
      thumbnail_path: null,
      error_message: null,
      cost_credits: null,
      created_at: now,
      completed_at: null,
    };

    set((s) => ({ items: [newGen, ...s.items] }));

    // Submit to the API
    try {
      const taskId: string = await invoke("submit_generation", {
        endpoint: api.endpoint,
        apiKey: api.api_key,
        model: api.model_id,
        content,
        parameters: {
          resolution,
          duration,
          seed: seed ?? null,
          camera_fixed,
          watermark,
        },
      });

      // Update DB + local state with task_id and processing status
      if (isTauri) {
        const db = await getDb();
        await db.execute(
          "UPDATE generations SET task_id = ?, status = ? WHERE id = ?",
          [taskId, "processing", id],
        );
      }
      get()._updateLocal(id, { task_id: taskId, status: "processing" });

      // Start polling
      get().startPolling(id, api);
    } catch (err) {
      const msg = String(err);
      if (isTauri) {
        const db = await getDb();
        await db.execute(
          "UPDATE generations SET status = ?, error_message = ? WHERE id = ?",
          ["failed", msg, id],
        );
      }
      get()._updateLocal(id, { status: "failed", error_message: msg });
    }

    return id;
  },

  // ---- poll ----------------------------------------------------------------
  async poll(generationId, api) {
    const gen = get().items.find((g) => g.id === generationId);
    if (!gen?.task_id) return;

    try {
      const result = await invoke<{
        task_id: string;
        status: string;
        video_url: string | null;
        error: string | null;
        raw_status: string;
      }>("poll_generation", {
        endpoint: api.endpoint,
        apiKey: api.api_key,
        taskId: gen.task_id,
      });

      const patch: Partial<Generation> = { status: result.status as GenerationStatus };

      if (result.status === "completed" && result.video_url) {
        // Download video to local storage
        let videoPath: string | null = null;
        try {
          videoPath = await invoke<string>("download_generation_video", {
            url: result.video_url,
            generationId,
          });
        } catch (dlErr) {
          console.warn("Video download failed:", dlErr);
        }
        patch.video_path = videoPath;
        patch.completed_at = Date.now();
        get().stopPolling(generationId);
      } else if (result.status === "failed") {
        patch.error_message = result.error ?? "Unknown error";
        patch.completed_at = Date.now();
        get().stopPolling(generationId);
      }

      if (isTauri && Object.keys(patch).length > 0) {
        const db = await getDb();
        const sets = Object.keys(patch)
          .map((k) => `${k} = ?`)
          .join(", ");
        const vals = [...Object.values(patch), generationId];
        await db.execute(
          `UPDATE generations SET ${sets} WHERE id = ?`,
          vals,
        );
      }
      get()._updateLocal(generationId, patch);
    } catch (err) {
      console.warn("poll error:", err);
    }
  },

  // ---- polling lifecycle ---------------------------------------------------
  startPolling(generationId, api) {
    if (intervals.has(generationId)) return;
    const iv = setInterval(() => {
      void get().poll(generationId, api);
    }, 5000);
    intervals.set(generationId, iv);
    set((s) => {
      const next = new Set(s.pollingIds);
      next.add(generationId);
      return { pollingIds: next };
    });
    // Immediate first poll
    void get().poll(generationId, api);
  },

  stopPolling(generationId) {
    const iv = intervals.get(generationId);
    if (iv) {
      clearInterval(iv);
      intervals.delete(generationId);
    }
    set((s) => {
      const next = new Set(s.pollingIds);
      next.delete(generationId);
      return { pollingIds: next };
    });
  },

  stopAllPolling() {
    for (const [id, iv] of intervals) {
      clearInterval(iv);
      intervals.delete(id);
    }
    set({ pollingIds: new Set() });
  },

  // ---- internal ------------------------------------------------------------
  _updateLocal(id, patch) {
    set((s) => ({
      items: s.items.map((g) => (g.id === id ? { ...g, ...patch } : g)),
    }));
  },
}));
