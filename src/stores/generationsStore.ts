import { invoke } from "@tauri-apps/api/core";
import { create } from "zustand";
import { isTauri } from "@/lib/tauri";
import { getDb } from "@/lib/db";
import { resolvePrompt } from "@/lib/tagResolver";
import { toast } from "@/stores/toastStore";
import type { ContentItem, DirectReference, ApiCredentials } from "@/lib/tagResolver";

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
  seed?: number | null;
  camera_fixed?: boolean;
  watermark?: boolean;
  audio_enabled?: boolean;
  directRefs?: DirectReference[];
  elements: Array<{ tag: string; id: string; images: Array<{ file_path: string }> }>;
  api: { endpoint: string; api_key: string; model_id: string; imgbb_api_key?: string };
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
  remove: (id: string) => Promise<void>;
  _updateLocal: (id: string, patch: Partial<Generation>) => void;
}

// ---------------------------------------------------------------------------
// DB row type
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
// Browser-mode HTTP helpers (used when !isTauri, routes through Vite proxy)
// ---------------------------------------------------------------------------

function normStatus(s: string): GenerationStatus {
  switch (s.toLowerCase()) {
    case "pending":
    case "queued":
    case "created":
      return "pending";
    case "running":
    case "processing":
    case "in_progress":
      return "processing";
    case "succeeded":
    case "success":
    case "completed":
    case "done":
      return "completed";
    case "failed":
    case "error":
    case "cancelled":
    case "canceled":
      return "failed";
    default:
      return "processing";
  }
}

type RawContentItem = {
  type: string;
  image_url?: { url: string };
  video_url?: { url: string }; // correct field name for video output items
};

function extractVideoUrl(data: Record<string, unknown>): string | null {
  type Choice = { message?: { content?: RawContentItem[] }; content?: RawContentItem[] };

  // Shape A: output.choices[0].message.content[].{type:"video_url", image_url:{url}}
  const output = data.output as {
    choices?: Choice[];
    video_url?: string;
    video_urls?: string[];
    url?: string;
  } | undefined;
  if (output?.choices) {
    for (const choice of output.choices) {
      const items = choice.message?.content ?? choice.content ?? [];
      for (const item of items) {
        if (item.type === "video_url") {
          // video_url is the correct field; image_url is the fallback
          if (item.video_url?.url) return item.video_url.url;
          if (item.image_url?.url) return item.image_url.url;
        }
      }
    }
  }
  // Shape B: output.video_url (Dreamina-Seedance-2.0)
  if (output?.video_url) return output.video_url;
  // Shape C: output.video_urls[0]
  if (output?.video_urls?.[0]) return output.video_urls[0];
  // Shape D: output.url
  if (output?.url) return output.url;

  // Shape E: task_result
  const tr = data.task_result as {
    video_url?: string;
    url?: string;
    videos?: Array<{ url?: string; video_url?: string }>;
  } | undefined;
  if (tr?.video_url) return tr.video_url;
  if (tr?.url) return tr.url;
  if (tr?.videos?.[0]) return tr.videos[0].url ?? tr.videos[0].video_url ?? null;

  // Shape F: Dreamina envelope data.video_info.video_url
  const dreaminaData = data.data as {
    video_url?: string;
    video_info?: { url?: string; video_url?: string };
  } | undefined;
  if (dreaminaData?.video_info?.video_url) return dreaminaData.video_info.video_url;
  if (dreaminaData?.video_info?.url) return dreaminaData.video_info.url;
  if (dreaminaData?.video_url) return dreaminaData.video_url;

  // Shape G: Dreamina Seedance 2.0 — top-level content.video_url
  const content = data.content as { video_url?: string; url?: string } | undefined;
  if (content?.video_url) return content.video_url;
  if (content?.url) return content.url;

  return null;
}

async function browserSubmit(
  api: { api_key: string; model_id: string },
  content: ContentItem[],
  params: {
    resolution: string;
    duration: number;
    ratio: string;
    seed: number | null;
    watermark: boolean;
    generate_audio: boolean;
  },
): Promise<string> {
  // BytePlus Seedance 2.0 uses flat top-level fields, not a nested "parameters" object
  const res = await fetch("/api-proxy/contents/generations/tasks", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${api.api_key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: api.model_id,
      content,
      duration: params.duration,
      ratio: params.ratio,
      resolution: params.resolution,
      ...(params.seed !== null ? { seed: params.seed } : {}),
      watermark: params.watermark,
      generate_audio: params.generate_audio,
    }),
  });

  const raw = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${raw}`);

  const data = JSON.parse(raw) as Record<string, unknown>;
  const taskId = (data.id ?? data.task_id) as string | undefined;
  if (!taskId) throw new Error(`No task_id in response: ${raw}`);
  return taskId;
}

async function browserPoll(
  taskId: string,
  apiKey: string,
): Promise<{ status: GenerationStatus; video_url: string | null; error: string | null }> {
  const res = await fetch(`/api-proxy/contents/generations/tasks/${taskId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  const raw = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${raw}`);

  const data = JSON.parse(raw) as Record<string, unknown>;
  // Log raw response so we can see the exact shape BytePlus returns
  console.debug("[poll] raw response:", JSON.stringify(data, null, 2));
  const rawStatus = ((data.status ?? data.task_status ?? "unknown") as string);
  const status = normStatus(rawStatus);
  const video_url = status === "completed" ? extractVideoUrl(data) : null;
  const errData = data.error as { message?: string } | undefined;
  const error =
    status === "failed" ? (errData?.message ?? `Task failed: ${rawStatus}`) : null;

  return { status, video_url, error };
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

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
      seed = null,
      camera_fixed = false,
      watermark = false,
      audio_enabled = true,
      elements,
      api,
    } = opts;

    // camera_fixed has no API parameter — inject a cinematography instruction into the prompt
    const effectivePrompt = camera_fixed
      ? `${prompt}. Static locked-off camera, no camera movement.`
      : prompt;

    // Resolve @tags + direct references → content array
    // Pass API credentials so images are uploaded as public URLs (avoids BytePlus content moderation)
    const apiCreds: ApiCredentials = {
      endpoint: api.endpoint,
      api_key: api.api_key,
      imgbb_api_key: api.imgbb_api_key || undefined,
    };
    const resolved = await resolvePrompt(effectivePrompt, elements, opts.directRefs ?? [], apiCreds);
    const content: ContentItem[] = resolved.content;
    const promptResolved = content
      .filter((c) => c.type === "text")
      .map((c) => c.text)
      .join(" ");

    const now = Date.now();
    // Use Tauri UUID command when available, otherwise fall back to browser crypto
    const id: string = isTauri
      ? await invoke<string>("new_uuid")
      : crypto.randomUUID();

    // Persist to SQLite (Tauri only)
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
          id, project_id, prompt, promptResolved, duration, resolution,
          aspect_ratio, "pro", seed,
          camera_fixed ? 1 : 0, watermark ? 1 : 0, audio_enabled ? 1 : 0,
          "pending", null, null, null, null, null, now, null,
        ],
      );

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
      id, project_id, prompt_raw: prompt, prompt_resolved: promptResolved,
      duration_s: duration, resolution, aspect_ratio, quality: "pro", seed,
      camera_fixed, watermark, audio_enabled,
      status: "pending", task_id: null, video_path: null,
      thumbnail_path: null, error_message: null, cost_credits: null,
      created_at: now, completed_at: null,
    };

    set((s) => ({ items: [newGen, ...s.items] }));

    // Submit to API — Tauri uses Rust command; browser uses fetch proxy
    try {
      const taskId: string = isTauri
        ? await invoke<string>("submit_generation", {
            endpoint: api.endpoint,
            apiKey: api.api_key,
            model: api.model_id,
            content,
            parameters: {
              resolution,
              duration,
              ratio: aspect_ratio,
              seed: seed ?? null,
              watermark,
              generate_audio: audio_enabled,
            },
          })
        : await browserSubmit(api, content, {
            resolution,
            duration,
            ratio: aspect_ratio,
            seed: seed ?? null,
            watermark,
            generate_audio: audio_enabled,
          });

      if (isTauri) {
        const db = await getDb();
        await db.execute(
          "UPDATE generations SET task_id = ?, status = ? WHERE id = ?",
          [taskId, "processing", id],
        );
      }
      get()._updateLocal(id, { task_id: taskId, status: "processing" });
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
      let status: GenerationStatus;
      let video_url: string | null = null;
      let errorMsg: string | null = null;
      let totalTokens: number | null = null;

      if (isTauri) {
        const result = await invoke<{
          task_id: string;
          status: string;
          video_url: string | null;
          error: string | null;
          raw_status: string;
          total_tokens: number | null;
        }>("poll_generation", {
          endpoint: api.endpoint,
          apiKey: api.api_key,
          taskId: gen.task_id,
        });
        status = result.status as GenerationStatus;
        video_url = result.video_url;
        errorMsg = result.error;
        totalTokens = result.total_tokens;
      } else {
        const result = await browserPoll(gen.task_id, api.api_key);
        status = result.status;
        video_url = result.video_url;
        errorMsg = result.error;
      }

      const patch: Partial<Generation> = { status };
      if (totalTokens) patch.cost_credits = totalTokens;

      if (status === "completed") {
        if (isTauri && video_url) {
          // Download to local file in Tauri
          try {
            patch.video_path = await invoke<string>("download_generation_video", {
              url: video_url,
              generationId,
            });
          } catch (dlErr) {
            console.warn("Video download failed:", dlErr);
            patch.video_path = video_url; // Fall back to URL
          }
        } else {
          // Browser mode: store the remote URL directly so the player can use it
          patch.video_path = video_url;
        }
        patch.completed_at = Date.now();
        get().stopPolling(generationId);
        const gen = get().items.find((g) => g.id === generationId);
        const label = gen?.prompt_raw
          ? gen.prompt_raw.length > 48
            ? gen.prompt_raw.slice(0, 45) + "…"
            : gen.prompt_raw
          : "Generation";
        toast.success("Generation complete", label);
      } else if (status === "failed") {
        patch.error_message = errorMsg ?? "Unknown error";
        patch.completed_at = Date.now();
        get().stopPolling(generationId);
        toast.error("Generation failed", errorMsg ?? undefined);
      }

      if (isTauri && Object.keys(patch).length > 0) {
        const db = await getDb();
        const sets = Object.keys(patch).map((k) => `${k} = ?`).join(", ");
        await db.execute(
          `UPDATE generations SET ${sets} WHERE id = ?`,
          [...Object.values(patch), generationId],
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
    const iv = setInterval(() => void get().poll(generationId, api), 5000);
    intervals.set(generationId, iv);
    set((s) => {
      const next = new Set(s.pollingIds);
      next.add(generationId);
      return { pollingIds: next };
    });
    void get().poll(generationId, api);
  },

  stopPolling(generationId) {
    const iv = intervals.get(generationId);
    if (iv) { clearInterval(iv); intervals.delete(generationId); }
    set((s) => {
      const next = new Set(s.pollingIds);
      next.delete(generationId);
      return { pollingIds: next };
    });
  },

  stopAllPolling() {
    for (const [, iv] of intervals) clearInterval(iv);
    intervals.clear();
    set({ pollingIds: new Set() });
  },

  async remove(id) {
    get().stopPolling(id);
    if (isTauri) {
      const db = await getDb();
      await db.execute("DELETE FROM generations WHERE id = ?", [id]);
    }
    set((s) => ({ items: s.items.filter((g) => g.id !== id) }));
  },

  _updateLocal(id, patch) {
    set((s) => ({
      items: s.items.map((g) => (g.id === id ? { ...g, ...patch } : g)),
    }));
  },
}));
