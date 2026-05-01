import { convertFileSrc } from "@tauri-apps/api/core";
import { isTauri } from "./tauri";

/**
 * Convert an absolute filesystem path to a URL the WebView can load.
 * In browser preview mode, returns an empty string (the UI should fall back
 * to a placeholder).
 */
export function assetUrl(filePath: string | null | undefined): string {
  if (!filePath) return "";
  if (!isTauri) return "";
  return convertFileSrc(filePath);
}
