import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Save, Activity, Database, Palette, CheckCircle, XCircle } from "lucide-react";
import { Button, Panel, HudInput } from "@/components/hud";
import { useSettings } from "@/stores/settingsStore";
import { isTauri } from "@/lib/tauri";

type TestState = "idle" | "testing" | "ok" | "fail";

export function Settings() {
  const settings = useSettings();
  const [endpoint, setEndpoint] = useState(settings.apiEndpoint);
  const [apiKey, setApiKey] = useState(settings.apiKey);
  const [modelId, setModelId] = useState(settings.modelId);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testState, setTestState] = useState<TestState>("idle");
  const [testMsg, setTestMsg] = useState("");

  useEffect(() => {
    setEndpoint(settings.apiEndpoint);
    setApiKey(settings.apiKey);
    setModelId(settings.modelId);
  }, [settings.apiEndpoint, settings.apiKey, settings.modelId]);

  async function handleSave() {
    setSaving(true);
    try {
      await settings.set("api_endpoint", endpoint);
      await settings.set("api_key", apiKey);
      await settings.set("model_id", modelId);
      setSaved(true);
      setTestState("idle");
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  async function handleTestConnection() {
    setTestState("testing");
    setTestMsg("");
    try {
      let msg: string;
      if (isTauri) {
        msg = await invoke<string>("test_api_connection", { endpoint, apiKey });
      } else {
        // Browser preview — call the models endpoint directly via fetch
        const res = await fetch(`${endpoint.replace(/\/$/, "")}/models`, {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        if (!res.ok) {
          const body = await res.text().catch(() => "");
          throw new Error(`HTTP ${res.status}: ${body}`);
        }
        msg = `OK — ${res.status}`;
      }
      setTestState("ok");
      setTestMsg(msg);
    } catch (e) {
      setTestState("fail");
      setTestMsg(String(e));
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

      {!isTauri && (
        <div className="border border-hud-amber/40 bg-hud-amber/5 px-4 py-3">
          <div className="hud-label text-hud-amber mb-1">Preview Mode</div>
          <p className="font-mono text-[0.7rem] text-fg-muted">
            Settings typed here are not saved — the database requires the Tauri runtime.
            You can still test the connection; the key is sent from your browser.
            Run <span className="text-hud-cyan">npm run tauri dev</span> for persistent storage.
          </p>
        </div>
      )}

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
          <HudInput
            label="Model ID"
            mono
            value={modelId}
            onChange={(e) => setModelId(e.target.value)}
            placeholder="seedance-1-0-lite-t2v-250528"
            hint="Find your exact model ID in the BytePlus console under ModelArk → My Models."
          />

          <div className="flex items-center gap-3 pt-2">
            <Button
              onClick={handleSave}
              loading={saving}
              iconLeft={<Save className="w-3.5 h-3.5" />}
            >
              {saved ? "Saved" : "Save"}
            </Button>
            <Button
              variant="secondary"
              onClick={handleTestConnection}
              loading={testState === "testing"}
              disabled={!apiKey}
            >
              Test Connection
            </Button>

            {testState === "ok" && (
              <span className="flex items-center gap-1.5 font-mono text-[0.65rem] text-hud-green">
                <CheckCircle className="w-3.5 h-3.5" />
                {testMsg}
              </span>
            )}
            {testState === "fail" && (
              <span className="flex items-center gap-1.5 font-mono text-[0.65rem] text-hud-red max-w-sm truncate">
                <XCircle className="w-3.5 h-3.5 shrink-0" />
                {testMsg}
              </span>
            )}
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
