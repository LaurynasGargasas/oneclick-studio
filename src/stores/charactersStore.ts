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
  id: string;             // job id (or uuid placeholder before we get one)
  batch_id: string;       // job-set id
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
  // current batch (the 4 in-flight or just-completed images)
  batchId: string | null;
  images: CharacterImage[];
  pollingBatchId: string | null;

  // history of past batches in memory (loaded once from DB)
  history: CharacterImage[];
  loaded: boolean;

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

function newId(): string {
  // local-only placeholder id; real one comes from JobSet.jobs[i].id
  return "tmp-" + Math.random().toString(36).slice(2, 12);
}

async function persistImage(img: CharacterImage): Promise<void> {
  if (!isTauri) return;
  const db = await getDb();
  await db.execute(
    `INSERT INTO characters (id, batch_id, prompt, options_json, image_url, status, error_message, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, datetime(?, 'unixepoch'))
     ON CONFLICT(id) DO UPDATE SET
       image_url = excluded.image_url,
       status = excluded.status,
       error_message = excluded.error_message`,
    [
      img.id,
      img.batch_id,
      img.prompt,
      img.options_json,
      img.image_url,
      img.status,
      img.error_message,
      Math.floor(img.created_at / 1000),
    ],
  );
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

let pollTimer: number | null = null;

export const useCharacters = create<CharactersState>((set, get) => ({
  batchId: null,
  images: [],
  pollingBatchId: null,
  history: [],
  loaded: false,

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
          batch_id: string;
          prompt: string;
          options_json: string;
          image_url: string | null;
          status: string;
          error_message: string | null;
          created_at: string;
        }>
      >("SELECT * FROM characters ORDER BY created_at DESC LIMIT 200");
      const history: CharacterImage[] = rows.map((r) => ({
        id: r.id,
        batch_id: r.batch_id,
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
    // 1) Show 4 skeleton tiles immediately
    const batch_id_placeholder = newId();
    const optionsJson = JSON.stringify(selections);
    const now = Date.now();
    const placeholderImages: CharacterImage[] = Array.from({ length: 4 }, () => ({
      id: newId(),
      batch_id: batch_id_placeholder,
      prompt,
      options_json: optionsJson,
      image_url: null,
      status: "queued",
      error_message: null,
      created_at: now,
    }));
    set({
      batchId: batch_id_placeholder,
      images: placeholderImages,
      pollingBatchId: batch_id_placeholder,
    });

    // 2) Submit
    let jobSet: JobSet;
    try {
      jobSet = await invoke<JobSet>("submit_character_batch", {
        apiKey: api_key,
        apiSecret: api_secret,
        prompt,
        widthAndHeight: size ?? "1536x2048",
        quality: quality ?? "1080p",
        batchSize: 4,
      });
    } catch (e) {
      const msg = String(e);
      set({
        images: placeholderImages.map((img) => ({
          ...img,
          status: "failed",
          error_message: msg,
        })),
        pollingBatchId: null,
      });
      toast.error("Generation failed", msg);
      throw e;
    }

    // 3) Update with real job IDs from server
    const realImages: CharacterImage[] = jobSet.jobs.map((j) => ({
      id: j.id,
      batch_id: jobSet.id,
      prompt,
      options_json: optionsJson,
      image_url: j.results?.raw?.url ?? null,
      status: mapStatus(j.status),
      error_message: null,
      created_at: now,
    }));
    set({ batchId: jobSet.id, images: realImages, pollingBatchId: jobSet.id });
    for (const img of realImages) await persistImage(img);

    // 4) Start polling
    void startPolling(api_key, api_secret, jobSet.id, set, get);
    return jobSet.id;
  },

  cancelPolling() {
    if (pollTimer != null) {
      clearTimeout(pollTimer);
      pollTimer = null;
    }
    set({ pollingBatchId: null });
  },

  clearCurrent() {
    if (pollTimer != null) {
      clearTimeout(pollTimer);
      pollTimer = null;
    }
    set({ batchId: null, images: [], pollingBatchId: null });
  },
}));

// ---------------------------------------------------------------------------
// Polling driver (lives outside the store so the timer ref is stable)
// ---------------------------------------------------------------------------

async function startPolling(
  api_key: string,
  api_secret: string,
  job_set_id: string,
  set: (partial: Partial<CharactersState> | ((s: CharactersState) => Partial<CharactersState>)) => void,
  get: () => CharactersState,
) {
  if (pollTimer != null) clearTimeout(pollTimer);

  const tick = async () => {
    if (get().pollingBatchId !== job_set_id) return; // user cancelled / new batch

    try {
      const js = await invoke<JobSet>("poll_character_batch", {
        apiKey: api_key,
        apiSecret: api_secret,
        jobSetId: job_set_id,
      });

      const images = js.jobs.map<CharacterImage>((j) => {
        const prev = get().images.find((i) => i.id === j.id) ?? get().images[0];
        return {
          id: j.id,
          batch_id: js.id,
          prompt: prev?.prompt ?? "",
          options_json: prev?.options_json ?? "{}",
          image_url: j.results?.raw?.url ?? null,
          status: mapStatus(j.status),
          error_message: null,
          created_at: prev?.created_at ?? Date.now(),
        };
      });
      set({ images });
      for (const img of images) await persistImage(img);

      const allDone = images.every(
        (i) =>
          i.status === "completed" ||
          i.status === "failed" ||
          i.status === "nsfw" ||
          i.status === "canceled",
      );

      if (allDone) {
        set({ pollingBatchId: null });
        pollTimer = null;
        // refresh history
        await get().load();
        const completed = images.filter((i) => i.status === "completed").length;
        if (completed > 0) toast.success("Generation ready", `${completed}/4 images`);
        return;
      }
    } catch (e) {
      // transient — keep polling, but surface persistent errors after a few hits
      console.warn("poll error:", e);
    }

    pollTimer = window.setTimeout(tick, 2500) as unknown as number;
  };

  pollTimer = window.setTimeout(tick, 1500) as unknown as number;
}
