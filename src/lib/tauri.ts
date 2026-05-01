import { invoke as tauriInvoke } from "@tauri-apps/api/core";

export async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  return tauriInvoke<T>(cmd, args);
}

export const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
