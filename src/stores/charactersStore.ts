// Character store — manages generations (= 4 images created together) and
// the on-disk history.
//
// Concurrency model (v0.1.5):
// ---------------------------
// Multiple generations can run in parallel.  We don't block the Generate
// button on in-flight work.  All polling tokens — across every concurrent
// generation — live in a single GLOBAL pool, ticked by one timer.  When a
// new generation submits, its 4 placeholders go into the pool alongside
// any still-running ones.
//
// Diversity: each generation fires 4 separate single-image POSTs in
// parallel so each tile gets its own seed.
//
// `images` (the right-hand "Output" panel) shows the MOST RECENT
// generation only.  All generations — current + finished + still-in-flight
// from previous clicks — live in `history`, where the History panel
// renders them grouped by generation_id.

import { invoke } from "@tauri-apps/api/core";
import { create } from "zustand";
import { isTauri } from "@/lib/tauri";
import { getDb } from "@/lib/db";
import { toast } from "@/stores/toastStore";
import type { CharacterSelections } from "@/lib/characterPrompt";
import { COMMON_NEGATIVE_PROMPT } from "@/lib/characterPrompt";
import {
  CHARACTER_MAX_POLLS,
  CHARACTER_POLL_INITIAL_DELAY_MS,
  CHARACTER_POLL_INTERVAL_MS,
} from "@/lib/config";

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
  id: string;                 // unique per image (job id once submitted)
  generation_id: string;      // shared by the 4 images of one Generate click
  job_set_id: string | null;  // Higgsfield job-set id used for polling
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
  /** Higgsfield Soul V2 aspect-ratio enum.  One of "9:16" | "16:9" |
   *  "4:3" | "3:4" | "1:1" | "2:3" | "3:2".  Defaults to "9:16" if
   *  omitted (hero-shot portrait).  Resolution is hardcoded to 1080p
   *  in the Rust command. */
  aspect_ratio?: string;
  /** How many parallel single-image submits to fire.  Clamped to [1, 4]
   *  internally — values outside that range will be silently snapped.
   *  Each submit gets its own random seed (batch_size=1 per call) so
   *  the N images are genuinely diverse, not near-duplicates. */
  count?: number;
}

interface CharactersState {
  // Most recent generation (the 4 in-flight or just-completed images)
  generationId: string | null;
  images: CharacterImage[];

  // Every image we have on disk, newest first.
  // Includes the current generation's images so the UI has one source of
  // truth and concurrent generations can update independently.
  history: CharacterImage[];
  loaded: boolean;

  // Global count of images still polling across ALL active generations.
  // Used by the UI to show "X in flight" without blocking submit.
  inFlightCount: number;

  load: () => Promise<void>;
  submit: (args: SubmitArgs) => Promise<string>;
  cancelAllPolling: () => void;
  clearCurrent: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// v0.1.8: expanded to handle Soul V2's broader status vocabulary.
// Higgsfield V1 used the compact enum on the left; V2 emits a wider mix
// ("running", "succeeded", "in_queue" etc.) that previously fell into
// the "in_progress" default and made polling spin forever.  The Rust
// poll command also overrides status to "completed" when a URL is
// present (URL-equals-done belt-and-suspenders) — see character.rs.
function mapStatus(raw: string): CharacterImageStatus {
  switch (raw.toLowerCase()) {
    case "queued":
    case "in_queue":
    case "pending":
    case "waiting":
      return "queued";
    case "in_progress":
    case "running":
    case "processing":
    case "rendering":
    case "started":
      return "in_progress";
    case "completed":
    case "succeeded":
    case "success":
    case "finished":
    case "done":
    case "complete":
      return "completed";
    case "failed":
    case "failure":
    case "error":
    case "errored":
      return "failed";
    case "nsfw":
    case "blocked":
    case "content_policy_violation":
    case "moderation":
      return "nsfw";
    case "canceled":
    case "cancelled":
      return "canceled";
    default:
      // Unknown status — log loudly so we catch schema drift, but keep
      // polling (don't terminate on an unrecognized value).  The poll
      // loop's max-poll cap (see ensurePollingLoop) prevents this from
      // spinning forever even if the status is permanently weird.
      // eslint-disable-next-line no-console
      console.warn("[characters] unknown status from API:", raw);
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
// Global polling pool — shared across every active generation
// ---------------------------------------------------------------------------

interface PoolEntry {
  jobSetId: string;
  generationId: string;
  apiKey: string;
  apiSecret: string;
  /** Number of poll ticks this image has been alive in the pool.  When
   *  it exceeds MAX_POLLS the image is force-failed with a clear error
   *  instead of polling forever — protects against unknown status terms
   *  or Higgsfield jobs that genuinely never finish. */
  polls: number;
}

// MAX_POLLS / poll interval / initial delay all come from src/lib/config.ts
// — tune there if Higgsfield's typical latency changes.
const MAX_POLLS = CHARACTER_MAX_POLLS;

let pollTimer: number | null = null;
const pollingPool: Map<string /* imageId */, PoolEntry> = new Map();
// Tracks generations we've already announced as complete via toast, so we
// don't fire multiple toasts when later poll ticks see the same final state.
const announcedGenerations = new Set<string>();

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useCharacters = create<CharactersState>((set, get) => ({
  generationId: null,
  images: [],
  history: [],
  loaded: false,
  inFlightCount: 0,

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

  async submit({ prompt, selections, api_key, api_secret, aspect_ratio, count }) {
    const generation_id = uuid();
    const optionsJson = JSON.stringify(selections);
    const now = Date.now();

    // Clamp count to [1, 4].  Higgsfield bills per image and each submit
    // is `batch_size=1` so an unbounded count would scale spend linearly
    // — capping at 4 matches the UI and prevents accidents.
    const n = Math.max(1, Math.min(4, Math.floor(count ?? 4)));

    // 1) Show N placeholder tiles immediately as the new "current" generation.
    const placeholders: CharacterImage[] = Array.from({ length: n }, () => ({
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

    // The new generation becomes "current"; previous in-flight generations
    // continue updating in `history` independently.
    set((s) => ({
      generationId: generation_id,
      images: placeholders,
      history: [...placeholders, ...s.history],
    }));

    // 2) Fire 4 parallel single-image submits (batch_size=1 each, so each
    //    tile gets its own random seed → real diversity).
    const submitOne = async (placeholderId: string): Promise<CharacterImage> => {
      try {
        const js = await invoke<JobSet>("submit_character_batch", {
          apiKey: api_key,
          apiSecret: api_secret,
          prompt,
          // Separate negative-prompt field — keeps unwanted-concept
          // tokens out of the positive prompt where they'd prime the
          // model.  Soul V2 may or may not honor this (Higgsfield
          // doesn't publicly document support), but it's harmless to
          // send and is the proper architectural place for negatives
          // if/when Higgsfield exposes it officially.
          negativePrompt: COMMON_NEGATIVE_PROMPT,
          aspectRatio: aspect_ratio ?? "9:16",
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
          id: placeholderId,
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

    const realImages = await Promise.all(
      placeholders.map((p) => submitOne(p.id)),
    );

    // 3) Replace placeholders with real images in BOTH `images` (only if
    //    this generation is still the current one) and `history`.
    set((s) => {
      const placeholderIds = new Set(placeholders.map((p) => p.id));
      return {
        images:
          s.generationId === generation_id ? realImages : s.images,
        history: [
          ...realImages,
          ...s.history.filter((h) => !placeholderIds.has(h.id)),
        ].slice(0, 1000),
      };
    });
    for (const img of realImages) await persistImage(img);

    // 4) Push every still-in-progress image into the global polling pool
    //    and ensure the polling loop is running.
    for (const img of realImages) {
      if (img.job_set_id && !isTerminal(img.status)) {
        pollingPool.set(img.id, {
          jobSetId: img.job_set_id,
          generationId: generation_id,
          apiKey: api_key,
          apiSecret: api_secret,
          polls: 0,
        });
      }
    }
    set({ inFlightCount: pollingPool.size });

    // If everything failed at submit time, surface a toast.
    if (realImages.every((i) => i.status === "failed")) {
      toast.error(
        "Generation failed",
        realImages[0]?.error_message ?? "All four submissions failed.",
      );
      announcedGenerations.add(generation_id);
      return generation_id;
    }

    ensurePollingLoop(set, get);
    return generation_id;
  },

  cancelAllPolling() {
    pollingPool.clear();
    announcedGenerations.clear();
    if (pollTimer != null) {
      clearTimeout(pollTimer);
      pollTimer = null;
    }
    set({ inFlightCount: 0 });
  },

  clearCurrent() {
    // Just clear what's shown as "current".  Polling continues for any
    // generations still in flight; they'll keep updating in History.
    set({ generationId: null, images: [] });
  },
}));

// ---------------------------------------------------------------------------
// Polling helpers
// ---------------------------------------------------------------------------

function patchImage(
  set: (
    partial:
      | Partial<CharactersState>
      | ((s: CharactersState) => Partial<CharactersState>),
  ) => void,
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

function ensurePollingLoop(
  set: (
    partial:
      | Partial<CharactersState>
      | ((s: CharactersState) => Partial<CharactersState>),
  ) => void,
  get: () => CharactersState,
): void {
  if (pollTimer != null) return; // already running

  const tick = async () => {
    if (pollingPool.size === 0) {
      pollTimer = null;
      set({ inFlightCount: 0 });
      return;
    }

    // Poll every outstanding job-set in parallel.
    const entries = Array.from(pollingPool.entries());
    await Promise.all(
      entries.map(async ([imageId, entry]) => {
        // Increment first so a thrown poll still counts toward the cap.
        entry.polls += 1;

        // Poll-count timeout: if Higgsfield never reports completion
        // within MAX_POLLS ticks, force-fail the image so the tile shows
        // an actionable error instead of an infinite spinner.  Most
        // commonly fires on truly stuck jobs or unrecognized status
        // values that would otherwise spin forever.
        if (entry.polls > MAX_POLLS) {
          patchImage(set, imageId, {
            status: "failed",
            error_message: `Polling timed out after ${MAX_POLLS} attempts (~${Math.round((MAX_POLLS * CHARACTER_POLL_INTERVAL_MS) / 60000)} min).  Job may be stuck or returning a status this app doesn't recognize.`,
          });
          const fresh = get().history.find((h) => h.id === imageId);
          if (fresh) await persistImage(fresh);
          pollingPool.delete(imageId);
          return;
        }

        try {
          const js = await invoke<JobSet>("poll_character_batch", {
            apiKey: entry.apiKey,
            apiSecret: entry.apiSecret,
            jobSetId: entry.jobSetId,
          });
          const job = js.jobs[0];
          if (!job) return;
          const url = job.results?.raw?.url ?? null;
          // URL-equals-done belt-and-suspenders.  The Rust poll already
          // overrides status to "completed" when a URL is present, but
          // we replicate the rule on the JS side so the check is robust
          // even if the user is on an older Rust binary (during dev
          // hot-reload of just the JS) or a future schema change slips
          // through somewhere.
          const status: CharacterImageStatus = url
            ? "completed"
            : mapStatus(job.status);
          patchImage(set, imageId, { status, image_url: url });

          const fresh = get().history.find((h) => h.id === imageId);
          if (fresh) await persistImage(fresh);

          if (isTerminal(status)) {
            pollingPool.delete(imageId);
          }
        } catch (e) {
          // transient — keep polling (count still incremented above so
          // we don't loop forever on a permanently-failing endpoint)
          console.warn("poll error for", imageId, e);
        }
      }),
    );

    set({ inFlightCount: pollingPool.size });

    // Check whether any generation just transitioned to "all done" —
    // surface one toast per generation, exactly once.
    const stillRunningGenerations = new Set<string>();
    for (const [, entry] of pollingPool) {
      stillRunningGenerations.add(entry.generationId);
    }
    const allGenerationsThisRun = new Set(entries.map(([, e]) => e.generationId));
    for (const gid of allGenerationsThisRun) {
      if (
        !stillRunningGenerations.has(gid) &&
        !announcedGenerations.has(gid)
      ) {
        announcedGenerations.add(gid);
        const final = get().history.filter((h) => h.generation_id === gid);
        const ok = final.filter((i) => i.status === "completed").length;
        if (ok > 0) toast.success("Generation ready", `${ok}/4 images`);
      }
    }

    if (pollingPool.size === 0) {
      pollTimer = null;
      set({ inFlightCount: 0 });
      return;
    }

    pollTimer = window.setTimeout(tick, CHARACTER_POLL_INTERVAL_MS) as unknown as number;
  };

  pollTimer = window.setTimeout(tick, CHARACTER_POLL_INITIAL_DELAY_MS) as unknown as number;
}
