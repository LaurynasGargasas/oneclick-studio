// Character store — manages a "generation" (= 4 images created together)
// and the on-disk history.
//
// Diversity strategy: we no longer ask Higgsfield for batch_size=4 because
// that produces near-identical variants.  Instead, every "Generate" click
// fires 4 separate POSTs with batch_size=1, each yielding its own JobSet
// with one job and its own random seed.  The four images of a single click
// share a client-generated `generation_id` so the History view can group
// them as one row.

import { invoke } from "@tauri-apps/api/core";
import { create } from "zustand";
import { isTauri } from "@/lib/tauri";
import { getDb } from "@/lib/db";
import { toast } from "@/stores/toastStore";
import type { CharacterSelections } from "@/lib/characterPrompt";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CharacterImageStatus =
  | "queued"
  | "in_progress"
  | "completed"
  | "failed"
  | "nsfw"
  | "canceled";

export interface CharacterImage {
  id: string;                    // unique per image (job id once submitted)
  generation_id: string;         // shared by the 4 images of one Generate click
  job_set_id: string | null;     // Higgsfield job-set id used for polling
  prompt: string;
  options_json: string;
  image_url: string | null;
  status: CharacterImageStatus;
  error_message: string | null;
  created_at: number;
}

interface JobSet {
  id: string;
  jobs: Array<{
    id: string;
    status: string;
    results?: { raw?: { url: string }; min?: { url: string } } | null;
  }>;
}

interface SubmitArgs {
  prompt: string;
  selections: CharacterSelections;
  api_key: string;
  api_secret: string;
  size?: string;
  quality?: string;
}

interface CharactersState {
  // current generation (the 4 in-flight or just-completed images)
  generationId: string | null;
  images: CharacterImage[];

  // history — every image we have on disk, newest first.
  // Includes the current generation's images so the UI has one source of truth.
  history: CharacterImage[];
  loaded: boolean;

  // are we still polling at least one image?
  pollingGenerationId: string | null;

  load: () => Promise<void>;
  submit: (args: SubmitArgs) => Promise<string>;
  cancelPolling: () => void;
  clearCurrent: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mapStatus(raw: string): CharacterImageStatus {
  switch (raw) {
    case "queued":
    case "in_progress":
    case "completed":
    case "failed":
    case "nsfw":
    case "canceled":
      return raw;
    default:
      return "in_progress";
  }
}

function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return "id-" + Math.random().toString(36).slice(2, 14);
}

async function persistImage(img: CharacterImage): Promise<void> {
  if (!isTauri) return;
  const db = await getDb();
  await db.execute(
    `INSERT INTO characters
       (id, batch_id, generation_id, prompt, options_json, image_url, status, error_message, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime(?, 'unixepoch'))
     ON CONFLICT(id) DO UPDATE SET
       batch_id = excluded.batch_id,
       generation_id = excluded.generation_id,
       image_url = excluded.image_url,
       status = excluded.status,
       error_message = excluded.error_message`,
    [
      img.id,
      img.job_set_id,
      img.generation_id,
      img.prompt,
      img.options_json,
      img.image_url,
      img.status,
      img.error_message,
      Math.floor(img.created_at / 1000),
    ],
  );
}

function isTerminal(s: CharacterImageStatus): boolean {
  return s === "completed" || s === "failed" || s === "nsfw" || s === "canceled";
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

let pollTimer: number | null = null;
let pollingTokens = new Map<string /* image id */, string /* job_set_id */>();

export const useCharacters = create<CharactersState>((set, get) => ({
  generationId: null,
  images: [],
  history: [],
  loaded: false,
  pollingGenerationId: null,

  async load() {
    if (!isTauri) {
      set({ loaded: true });
      return;
    }
    try {
      const db = await getDb();
      const rows = await db.select<
        Array<{
          id: string;
          batch_id: string | null;
          generation_id: string | null;
          prompt: string;
          options_json: string;
          image_url: string | null;
          status: string;
          error_message: string | null;
          created_at: string;
        }>
      >(
        "SELECT id, batch_id, generation_id, prompt, options_json, image_url, status, error_message, created_at FROM characters ORDER BY created_at DESC LIMIT 500",
      );
      const history: CharacterImage[] = rows.map((r) => ({
        id: r.id,
        generation_id: r.generation_id ?? r.batch_id ?? r.id,
        job_set_id: r.batch_id,
        prompt: r.prompt,
        options_json: r.options_json,
        image_url: r.image_url,
        status: mapStatus(r.status),
        error_message: r.error_message,
        created_at: new Date(r.created_at).getTime(),
      }));
      set({ history, loaded: true });
    } catch (e) {
      console.error("Failed to load characters:", e);
      set({ loaded: true });
    }
  },

  async submit({ prompt, selections, api_key, api_secret, size, quality }) {
    const generation_id = uuid();
    const optionsJson = JSON.stringify(selections);
    const now = Date.now();

    // 1) Create 4 placeholder images and show them immediately
    const placeholders: CharacterImage[] = Array.from({ length: 4 }, () => ({
      id: "tmp-" + uuid(),
      generation_id,
      job_set_id: null,
      prompt,
      options_json: optionsJson,
      image_url: null,
      status: "queued",
      error_message: null,
      created_at: now,
    }));

    set({
      generationId: generation_id,
      images: placeholders,
      pollingGenerationId: generation_id,
      history: [...placeholders, ...get().history],
    });

    // 2) Fire 4 parallel single-image submits.  Each yields its own JobSet
    //    with exactly one job — that's how we get true diversity (the model
    //    samples a fresh seed per request).
    const submitOne = async (placeholderId: string): Promise<CharacterImage> => {
      try {
        const js = await invoke<JobSet>("submit_character_batch", {
          apiKey: api_key,
          apiSecret: api_secret,
          prompt,
          widthAndHeight: size ?? "1536x2048",
          quality: quality ?? "1080p",
          batchSize: 1,
        });
        const job = js.jobs[0];
        if (!job) throw new Error("Higgsfield returned an empty JobSet");
        return {
          id: job.id,
          generation_id,
          job_set_id: js.id,
          prompt,
          options_json: optionsJson,
          image_url: job.results?.raw?.url ?? null,
          status: mapStatus(job.status),
          error_message: null,
          created_at: now,
        };
      } catch (e) {
        return {
          id: placeholderId, // keep placeholder id so React keys stay stable
          generation_id,
          job_set_id: null,
          prompt,
          options_json: optionsJson,
          image_url: null,
          status: "failed",
          error_message: String(e),
          created_at: now,
        };
      }
    };

    // Submit all four in parallel; replace placeholders one by one as each
    // request returns.  This gives the user immediate feedback per slot.
    const realImages = await Promise.all(
      placeholders.map((p) => submitOne(p.id)),
    );

    // 3) Replace placeholders with real images
    replaceImages(set, get, generation_id, placeholders, realImages);
    for (const img of realImages) await persistImage(img);

    // Update polling tokens
    pollingTokens.clear();
    for (const img of realImages) {
      if (img.job_set_id && !isTerminal(img.status)) {
        pollingTokens.set(img.id, img.job_set_id);
      }
    }

    // If everything failed at submit time, stop here.
    if (pollingTokens.size === 0) {
      set({ pollingGenerationId: null });
      const okCount = realImages.filter((i) => i.status === "completed").length;
      if (okCount === 0) {
        toast.error("Generation failed", realImages[0]?.error_message ?? "All four submissions failed.");
      }
      return generation_id;
    }

    // 4) Start polling each in-progress image
    void startPolling(api_key, api_secret, generation_id, set, get);
    return generation_id;
  },

  cancelPolling() {
    pollingTokens.clear();
    if (pollTimer != null) {
      clearTimeout(pollTimer);
      pollTimer = null;
    }
    set({ pollingGenerationId: null });
  },

  clearCurrent() {
    pollingTokens.clear();
    if (pollTimer != null) {
      clearTimeout(pollTimer);
      pollTimer = null;
    }
    set({ generationId: null, images: [], pollingGenerationId: null });
  },
}));

// ---------------------------------------------------------------------------
// Helpers that need access to set/get
// ---------------------------------------------------------------------------

function replaceImages(
  set: (partial: Partial<CharactersState> | ((s: CharactersState) => Partial<CharactersState>)) => void,
  get: () => CharactersState,
  generation_id: string,
  oldImages: CharacterImage[],
  newImages: CharacterImage[],
) {
  set((s) => {
    const oldIds = new Set(oldImages.map((o) => o.id));
    return {
      images: s.generationId === generation_id ? newImages : s.images,
      history: [
        ...newImages,
        ...s.history.filter((h) => !oldIds.has(h.id) && h.generation_id !== generation_id),
      ].slice(0, 1000),
    };
  });
  void get; // unused
}

function patchImage(
  set: (partial: Partial<CharactersState> | ((s: CharactersState) => Partial<CharactersState>)) => void,
  imageId: string,
  patch: Partial<CharacterImage>,
) {
  set((s) => {
    const apply = (img: CharacterImage): CharacterImage =>
      img.id === imageId ? { ...img, ...patch } : img;
    return {
      images: s.images.map(apply),
      history: s.history.map(apply),
    };
  });
}

// ---------------------------------------------------------------------------
// Polling driver — polls each image's job-set on its own
// ---------------------------------------------------------------------------

async function startPolling(
  api_key: string,
  api_secret: string,
  generation_id: string,
  set: (partial: Partial<CharactersState> | ((s: CharactersState) => Partial<CharactersState>)) => void,
  get: () => CharactersState,
) {
  if (pollTimer != null) clearTimeout(pollTimer);

  const tick = async () => {
    if (get().pollingGenerationId !== generation_id) return;
    if (pollingTokens.size === 0) {
      set({ pollingGenerationId: null });
      pollTimer = null;
      return;
    }

    // Poll all outstanding job-sets in parallel
    const entries = Array.from(pollingTokens.entries());
    await Promise.all(
      entries.map(async ([imageId, jobSetId]) => {
        try {
          const js = await invoke<JobSet>("poll_character_batch", {
            apiKey: api_key,
            apiSecret: api_secret,
            jobSetId: jobSetId,
          });
          const job = js.jobs[0];
          if (!job) return;
          const status = mapStatus(job.status);
          const url = job.results?.raw?.url ?? null;

          patchImage(set, imageId, {
            status,
            image_url: url,
          });

          // Persist
          const fresh = get().history.find((h) => h.id === imageId);
          if (fresh) await persistImage(fresh);

          if (isTerminal(status)) {
            pollingTokens.delete(imageId);
          }
        } catch (e) {
          // transient — keep polling but log
          console.warn("poll error for", imageId, e);
        }
      }),
    );

    if (pollingTokens.size === 0) {
      set({ pollingGenerationId: null });
      pollTimer = null;
      const final = get().images.filter((i) => i.generation_id === generation_id);
      const ok = final.filter((i) => i.status === "completed").length;
      if (ok > 0) toast.success("Generation ready", `${ok}/4 images`);
      return;
    }

    pollTimer = window.setTimeout(tick, 2500) as unknown as number;
  };

  pollTimer = window.setTimeout(tick, 1500) as unknown as number;
}
