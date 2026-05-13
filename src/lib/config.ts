// Frontend-side configuration constants.
//
// Centralized here so future tuning (rate limit changes, new toast
// variants, swapping the placeholder image host) is a one-file edit
// instead of a grep across stores + components.  Each constant has a
// short comment explaining the "why" so we don't lose context when
// someone wants to bump a number months from now.
//
// Rust-side constants live at the top of their respective command
// files (`src-tauri/src/commands/*.rs`).  Cross-language config (e.g.
// the `9:16` default aspect ratio) is documented in `character.rs`
// because it's authored Rust-side; the JS store reads it from the
// SQLite `settings` row populated by the migration.

// ── Default API endpoints ────────────────────────────────────────────
//
// BytePlus Seedance.  This is the ap-southeast endpoint we ship as
// the default; users can override in Settings if they're routing via
// a different region.  Mirrored in `Settings.tsx` as the input
// placeholder so the example matches what's actually stored.
export const DEFAULT_BYTEPLUS_ENDPOINT =
  "https://ark.ap-southeast.bytepluses.com/api/v3";

// ── Polling intervals (ms) ───────────────────────────────────────────
//
// Video generations (BytePlus Seedance): 5s tick.  Seedance takes
// 30–120s; faster polling buys little but doubles API call cost,
// slower polling makes the UI feel laggy when it completes.
export const VIDEO_POLL_INTERVAL_MS = 5000;

// Character generations (Higgsfield Soul V2): 2.5s tick.  Soul jobs
// usually take 30–90s; the tighter interval makes the UI feel snappy
// and Higgsfield doesn't rate-limit at this cadence.
export const CHARACTER_POLL_INTERVAL_MS = 2500;

// Backoff delay before the FIRST tick after a new generation submits
// — gives Higgsfield a moment to spin the job up before we hammer
// the status endpoint.
export const CHARACTER_POLL_INITIAL_DELAY_MS = 1500;

// Safety cap: how many poll ticks before we force-fail a character
// generation that never reached a terminal status.  240 × 2.5s = 10
// minutes, comfortably beyond Higgsfield's normal latency.  Guards
// against the "status string this app doesn't recognize" failure
// mode that v0.1.8 fixed in mapStatus.
export const CHARACTER_MAX_POLLS = 240;

// ── Toast durations (ms) ─────────────────────────────────────────────
//
// Error messages stick longest (users need time to read), info
// shortest (frequent, low signal).  Tweak here, not per-call.
export const TOAST_DURATIONS: Record<
  "success" | "error" | "warning" | "info",
  number
> = {
  success: 4500,
  error: 6000,
  warning: 5000,
  info: 4000,
};

// Default toast duration when the caller doesn't pass a variant.
export const DEFAULT_TOAST_DURATION_MS = TOAST_DURATIONS.success;

// ── Placeholder image URLs ───────────────────────────────────────────
//
// Used by the landing-page snippet templates when the user inserts a
// hero/section block and hasn't dropped in their own image yet.  If
// placehold.co goes down or we switch providers, change here only.
//
// The query-string params encode size + colors + caption — keeping
// the URL shape consistent lets us pivot to a different host (e.g.
// dummyimage.com) by swapping the base URL alone.
export const PLACEHOLDER_IMAGE_URL_HERO =
  "https://placehold.co/1200x600/e5e7eb/64748b?text=Drop+an+image";
export const PLACEHOLDER_IMAGE_URL_SECTION =
  "https://placehold.co/600x400/e5e7eb/64748b?text=Drop+an+image";
