import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Save, Activity, CheckCircle, XCircle, Monitor, ExternalLink, Zap, ImageUp } from "lucide-react";
import { Button, Panel, HudInput } from "@/components/hud";
import { useSettings } from "@/stores/settingsStore";
import { useGenerations } from "@/stores/generationsStore";
import { toast } from "@/stores/toastStore";
import { isTauri } from "@/lib/tauri";

type TestState = "idle" | "testing" | "ok" | "fail";

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function Settings() {
  const settings = useSettings();
  const generations = useGenerations((s) => s.items);
  const [endpoint, setEndpoint] = useState(settings.apiEndpoint);
  const [apiKey, setApiKey] = useState(settings.apiKey);
  const [modelId, setModelId] = useState(settings.modelId);
  const [imgbbApiKey, setImgbbApiKey] = useState(settings.imgbbApiKey);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testState, setTestState] = useState<TestState>("idle");
  const [testMsg, setTestMsg] = useState("");
  const [creatingShortcut, setCreatingShortcut] = useState(false);

  const usageStats = useMemo(() => {
    let totalTokens = 0;
    let completedCount = 0;
    for (const g of generations) {
      if (g.status === "completed") {
        completedCount++;
        if (g.cost_credits) totalTokens += g.cost_credits;
      }
    }
    return { totalTokens, completedCount };
  }, [generations]);

  async function handleCreateShortcut() {
    setCreatingShortcut(true);
    try {
      const path = await invoke<string>("create_desktop_shortcut");
      toast.success("Shortcut created", path);
    } catch (e) {
      toast.error("Shortcut failed", String(e));
    } finally {
      setCreatingShortcut(false);
    }
  }

  useEffect(() => {
    setEndpoint(settings.apiEndpoint);
    setApiKey(settings.apiKey);
    setModelId(settings.modelId);
    setImgbbApiKey(settings.imgbbApiKey);
  }, [settings.apiEndpoint, settings.apiKey, settings.modelId, settings.imgbbApiKey]);

  async function handleSave() {
    setSaving(true);
    try {
      await settings.set("api_endpoint", endpoint);
      await settings.set("api_key", apiKey);
      await settings.set("model_id", modelId);
      await settings.set("imgbb_api_key", imgbbApiKey);
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
        // Browser preview — route through Vite dev proxy to avoid CORS
        const res = await fetch("/api-proxy/models", {
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

      {/* Image Hosting — imgbb */}
      <Panel className="p-6">
        <div className="flex items-center gap-2 mb-5">
          <ImageUp className="w-4 h-4 text-hud-cyan" strokeWidth={1.5} />
          <h2 className="hud-label text-fg">Reference Image Hosting</h2>
        </div>

        <p className="font-mono text-[0.65rem] text-fg-muted mb-4 leading-relaxed">
          BytePlus content moderation can reject base64-encoded images of real people.
          Providing an <span className="text-hud-cyan">imgbb</span> API key lets the app
          upload reference images to a public CDN first, then pass the URL to BytePlus —
          the same approach professional tools use.
          imgbb is free: <a
            href="https://api.imgbb.com/"
            target="_blank"
            rel="noreferrer"
            className="text-hud-cyan hover:underline"
          >get a free API key at api.imgbb.com</a>.
        </p>

        <HudInput
          label="imgbb API Key"
          type="password"
          mono
          value={imgbbApiKey}
          onChange={(e) => setImgbbApiKey(e.target.value)}
          placeholder="Leave blank to disable"
          hint="Optional. When set, reference images are uploaded to imgbb before generation. Uploaded images are permanent unless you delete them from imgbb."
        />

        {imgbbApiKey && (
          <p className="font-mono text-[0.6rem] text-hud-green mt-2">
            ✓ imgbb hosting active — reference images will be uploaded before generation
          </p>
        )}
      </Panel>

      {/* Usage & Credits */}
      <Panel className="p-6">
        <div className="flex items-center gap-2 mb-5">
          <Zap className="w-4 h-4 text-hud-cyan" strokeWidth={1.5} />
          <h2 className="hud-label text-fg">Usage &amp; Credits</h2>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-5">
          <div className="border border-border-hud bg-bg-elevated/40 p-4">
            <div className="hud-label text-fg-dim mb-1">Tokens Used (local)</div>
            <div className="font-mono text-2xl text-hud-cyan hud-text-glow-cyan tabular-nums">
              {formatTokens(usageStats.totalTokens)}
            </div>
            <div className="font-mono text-[0.6rem] text-fg-dim mt-1">
              across {usageStats.completedCount} completed generation{usageStats.completedCount !== 1 ? "s" : ""}
            </div>
          </div>
          <div className="border border-border-hud bg-bg-elevated/40 p-4">
            <div className="hud-label text-fg-dim mb-1">Avg per Generation</div>
            <div className="font-mono text-2xl text-fg tabular-nums">
              {usageStats.completedCount > 0
                ? formatTokens(Math.round(usageStats.totalTokens / usageStats.completedCount))
                : "—"}
            </div>
            <div className="font-mono text-[0.6rem] text-fg-dim mt-1">tokens / generation</div>
          </div>
        </div>

        <p className="font-mono text-[0.65rem] text-fg-muted mb-3">
          Token counts are recorded from API responses. To check your remaining balance and purchase more credits, visit the BytePlus console.
        </p>
        <a
          href="https://console.byteplus.com/modelark/resourcecenter"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 font-mono text-[0.65rem] text-hud-cyan hover:underline"
        >
          <ExternalLink className="w-3 h-3" />
          Open BytePlus Resource Centre
        </a>
      </Panel>

      {/* System */}
      {isTauri && (
        <Panel className="p-6">
          <div className="flex items-center gap-2 mb-5">
            <Monitor className="w-4 h-4 text-hud-cyan" strokeWidth={1.5} />
            <h2 className="hud-label text-fg">System</h2>
          </div>
          <div className="flex items-center gap-4">
            <Button
              variant="secondary"
              loading={creatingShortcut}
              iconLeft={<Monitor className="w-3.5 h-3.5" />}
              onClick={() => void handleCreateShortcut()}
            >
              Create Desktop Shortcut
            </Button>
            <p className="font-mono text-[0.65rem] text-fg-muted">
              Adds a Seedance Studio .lnk to your Windows desktop.
            </p>
          </div>
        </Panel>
      )}
    </div>
  );
}
