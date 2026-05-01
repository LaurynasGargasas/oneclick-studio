import { create } from "zustand";
import Database from "@tauri-apps/plugin-sql";
import { isTauri } from "@/lib/tauri";

const DB_URL = "sqlite:seedance.db";

let dbPromise: Promise<Database> | null = null;
async function getDb(): Promise<Database> {
  if (!dbPromise) {
    dbPromise = Database.load(DB_URL);
  }
  return dbPromise;
}

interface SettingsRow {
  key: string;
  value: string | null;
}

interface SettingsState {
  apiEndpoint: string;
  apiKey: string;
  defaultResolution: string;
  defaultDuration: string;
  defaultAspectRatio: string;
  defaultQuality: string;
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
  defaultResolution: "720p",
  defaultDuration: "6",
  defaultAspectRatio: "16:9",
  defaultQuality: "standard",
  themeAccent: "#00f0ff",
  animationIntensity: "full",
};

const KEY_MAP: Record<string, keyof typeof DEFAULTS> = {
  api_endpoint: "apiEndpoint",
  api_key: "apiKey",
  default_resolution: "defaultResolution",
  default_duration: "defaultDuration",
  default_aspect_ratio: "defaultAspectRatio",
  default_quality: "defaultQuality",
  theme_accent: "themeAccent",
  animation_intensity: "animationIntensity",
};

export const useSettings = create<SettingsState>((set) => ({
  ...DEFAULTS,
  loaded: false,
  error: null,

  async load() {
    if (!isTauri) {
      // Browser preview mode — defaults only.
      set({ loaded: true });
      return;
    }
    try {
      const db = await getDb();
      const rows = await db.select<SettingsRow[]>("SELECT key, value FROM settings");
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
