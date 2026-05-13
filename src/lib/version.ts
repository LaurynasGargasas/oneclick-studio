// Single source of truth for the version string shown in the UI.
//
// Reads `tauri.conf.json` at runtime via `@tauri-apps/api/app`.getVersion()
// so we never have to remember to bump the version in two places (was
// hardcoded "v0.1.0" in Sidebar.tsx pre-v0.1.8 — silent drift across
// every release).  Cached after the first call so route switches don't
// re-invoke the bridge.
//
// In non-Tauri preview mode (`npm run dev` standalone) the bridge is
// unavailable, so we return "dev" — the sidebar shows "vdev" which is
// a clear "I'm in browser preview, not the real app" signal.

import { useEffect, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { isTauri } from "@/lib/tauri";

let cached: string | null = null;

/** React hook that returns the app version string (no leading "v").
 *  Updates exactly once after mount in Tauri mode; cached across the
 *  rest of the session. */
export function useVersion(): string {
  const [v, setV] = useState<string>(cached ?? (isTauri ? "" : "dev"));

  useEffect(() => {
    if (cached !== null) return;
    if (!isTauri) {
      cached = "dev";
      return;
    }
    let cancelled = false;
    void getVersion()
      .then((res) => {
        cached = res;
        if (!cancelled) setV(res);
      })
      .catch((err) => {
        // Non-fatal — leaves the sidebar showing nothing rather than a
        // wrong number.  Worth a console for debugging.
        // eslint-disable-next-line no-console
        console.warn("[version] failed to read app version:", err);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return v;
}
