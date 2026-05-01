import { useEffect, useState } from "react";
import { Save, Activity, Database, Palette } from "lucide-react";
import { Button, Panel, HudInput } from "@/components/hud";
import { useSettings } from "@/stores/settingsStore";

export function Settings() {
  const settings = useSettings();
  const [endpoint, setEndpoint] = useState(settings.apiEndpoint);
  const [apiKey, setApiKey] = useState(settings.apiKey);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setEndpoint(settings.apiEndpoint);
    setApiKey(settings.apiKey);
  }, [settings.apiEndpoint, settings.apiKey]);

  async function handleSave() {
    setSaving(true);
    try {
      await settings.set("api_endpoint", endpoint);
      await settings.set("api_key", apiKey);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-8 max-w-[1100px] mx-auto space-y-8">
      <header>
        <div className="hud-label text-fg-dim mb-1">// Configuration</div>
        <h1 className="font-mono text-2xl uppercase tracking-[0.08em] text-fg hud-text-glow-cyan">
          Settings
        </h1>
      </header>

      {/* API Configuration */}
      <Panel className="p-6">
        <div className="flex items-center gap-2 mb-5">
          <Activity className="w-4 h-4 text-hud-cyan" strokeWidth={1.5} />
          <h2 className="hud-label text-fg">API Configuration</h2>
        </div>

        <div className="space-y-4">
          <HudInput
            label="Endpoint"
            mono
            value={endpoint}
            onChange={(e) => setEndpoint(e.target.value)}
            placeholder="https://ark.ap-southeast.bytepluses.com/api/v3"
            hint="BytePlus ModelArk base URL. Override for China endpoint or proxy."
          />
          <HudInput
            label="API Key"
            type="password"
            mono
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="•••••••••••••••••••••••••••"
            hint="Stored locally in your app database. Never sent anywhere except the configured endpoint."
          />

          <div className="flex items-center gap-3 pt-2">
            <Button onClick={handleSave} loading={saving} iconLeft={<Save className="w-3.5 h-3.5" />}>
              {saved ? "Saved" : "Save"}
            </Button>
            <Button variant="secondary" disabled>
              Test Connection
            </Button>
            <span className="font-mono text-[0.65rem] text-fg-dim ml-auto">
              Test connection wired up in Phase 4
            </span>
          </div>
        </div>
      </Panel>

      {/* Defaults */}
      <Panel className="p-6">
        <div className="flex items-center gap-2 mb-5">
          <Database className="w-4 h-4 text-hud-cyan" strokeWidth={1.5} />
          <h2 className="hud-label text-fg">Generation Defaults</h2>
        </div>
        <p className="font-mono text-xs text-fg-muted">
          Default duration / resolution / aspect ratio / quality controls land here in Phase 5.
        </p>
      </Panel>

      {/* Appearance */}
      <Panel className="p-6">
        <div className="flex items-center gap-2 mb-5">
          <Palette className="w-4 h-4 text-hud-cyan" strokeWidth={1.5} />
          <h2 className="hud-label text-fg">Appearance</h2>
        </div>
        <p className="font-mono text-xs text-fg-muted">
          Theme accent picker and animation intensity slider land here in Phase 7.
        </p>
      </Panel>
    </div>
  );
}
