import { create } from "zustand";
import { isTauri } from "@/lib/tauri";
import { getDb } from "@/lib/db";

interface SettingsRow {
  key: string;
  value: string | null;
}

interface SettingsState {
  apiEndpoint: string;
  apiKey: string;
  modelId: string;
  imgbbApiKey: string;
  higgsfieldApiKey: string;
  higgsfieldApiSecret: string;
  anthropicApiKey: string;
  defaultResolution: string;
  defaultDuration: string;
  defaultAspectRatio: string;
  defaultQuality: string;
  /** Aspect-ratio enum for the Character Creator (Higgsfield Soul V2).
   *  One of "9:16" | "16:9" | "4:3" | "3:4" | "1:1" | "2:3" | "3:2".
   *  Separate from `defaultAspectRatio` which is used by video gens. */
  characterAspectRatio: string;
  /** How many images to generate per click — string-encoded "1".."4".
   *  Parsed and clamped to 1..4 at use time.  Defaults to "4". */
  characterCount: string;
  themeAccent: string;
  animationIntensity: string;
  loaded: boolean;
  error: string | null;
  load: () => Promise<void>;
  set: (key: string, value: string) => Promise<void>;
}

const DEFAULTS = {
  apiEndpoint: "https://ark.ap-southeast.bytepluses.com/api/v3",
  apiKey: "",
  modelId: "seedance-1-0-lite-t2v-250528",
  imgbbApiKey: "",
  higgsfieldApiKey: "",
  higgsfieldApiSecret: "",
  anthropicApiKey: "",
  defaultResolution: "720p",
  defaultDuration: "6",
  defaultAspectRatio: "16:9",
  defaultQuality: "standard",
  characterAspectRatio: "9:16",
  characterCount: "4",
  themeAccent: "#00f0ff",
  animationIntensity: "full",
};

const KEY_MAP: Record<string, keyof typeof DEFAULTS> = {
  api_endpoint: "apiEndpoint",
  api_key: "apiKey",
  model_id: "modelId",
  imgbb_api_key: "imgbbApiKey",
  higgsfield_api_key: "higgsfieldApiKey",
  higgsfield_api_secret: "higgsfieldApiSecret",
  anthropic_api_key: "anthropicApiKey",
  default_resolution: "defaultResolution",
  default_duration: "defaultDuration",
  default_aspect_ratio: "defaultAspectRatio",
  default_quality: "defaultQuality",
  character_aspect_ratio: "characterAspectRatio",
  character_count: "characterCount",
  theme_accent: "themeAccent",
  animation_intensity: "animationIntensity",
};

export const useSettings = create<SettingsState>((set) => ({
  ...DEFAULTS,
  loaded: false,
  error: null,

  async load() {
    if (!isTauri) {
      set({ loaded: true });
      return;
    }
    try {
      const db = await getDb();
      const rows = await db.select<SettingsRow[]>(
        "SELECT key, value FROM settings",
      );
      const partial: Partial<typeof DEFAULTS> = {};
      for (const row of rows) {
        const camelKey = KEY_MAP[row.key];
        if (camelKey && row.value !== null) {
          partial[camelKey] = row.value;
        }
      }
      set({ ...partial, loaded: true, error: null });
    } catch (err) {
      console.error("Failed to load settings:", err);
      set({ loaded: true, error: String(err) });
    }
  },

  async set(key: string, value: string) {
    const camelKey = KEY_MAP[key];
    if (!camelKey) {
      throw new Error(`Unknown settings key: ${key}`);
    }
    if (isTauri) {
      const db = await getDb();
      await db.execute(
        "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        [key, value],
      );
    }
    set({ [camelKey]: value } as Partial<SettingsState>);
  },
}));
