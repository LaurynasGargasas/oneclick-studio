import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Save, Activity, CheckCircle, XCircle, Monitor, ExternalLink, Zap, ImageUp, Download, RefreshCw, UserCog } from "lucide-react";
import { check as checkForUpdate, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { getVersion } from "@tauri-apps/api/app";
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
  const [higgsfieldApiKey, setHiggsfieldApiKey] = useState(settings.higgsfieldApiKey);
  const [higgsfieldApiSecret, setHiggsfieldApiSecret] = useState(settings.higgsfieldApiSecret);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testState, setTestState] = useState<TestState>("idle");
  const [testMsg, setTestMsg] = useState("");
  const [creatingShortcut, setCreatingShortcut] = useState(false);

  // Updater state
  const [currentVersion, setCurrentVersion] = useState<string>("");
  const [updateState, setUpdateState] = useState<
    | { phase: "idle" }
    | { phase: "checking" }
    | { phase: "available"; update: Update }
    | { phase: "uptodate"; checkedAt: number }
    | { phase: "downloading"; downloaded: number; total: number | null }
    | { phase: "installing" }
    | { phase: "ready" }
    | { phase: "error"; message: string }
  >({ phase: "idle" });

  useEffect(() => {
    if (!isTauri) return;
    void getVersion().then(setCurrentVersion).catch(() => {});
  }, []);

  async function handleCheckForUpdate() {
    setUpdateState({ phase: "checking" });
    try {
      const update = await checkForUpdate();
      if (update) {
        setUpdateState({ phase: "available", update });
      } else {
        setUpdateState({ phase: "uptodate", checkedAt: Date.now() });
      }
    } catch (e) {
      setUpdateState({ phase: "error", message: String(e) });
      toast.error("Update check failed", String(e));
    }
  }

  async function handleInstallUpdate() {
    if (updateState.phase !== "available") return;
    const update = updateState.update;
    let downloaded = 0;
    let total: number | null = null;
    setUpdateState({ phase: "downloading", downloaded: 0, total: null });
    try {
      await update.downloadAndInstall((event) => {
        if (event.event === "Started") {
          total = event.data.contentLength ?? null;
          setUpdateState({ phase: "downloading", downloaded: 0, total });
        } else if (event.event === "Progress") {
          downloaded += event.data.chunkLength;
          setUpdateState({ phase: "downloading", downloaded, total });
        } else if (event.event === "Finished") {
          setUpdateState({ phase: "installing" });
        }
      });
      setUpdateState({ phase: "ready" });
      toast.success("Update installed", "Restarting…");
      setTimeout(() => void relaunch(), 800);
    } catch (e) {
      setUpdateState({ phase: "error", message: String(e) });
      toast.error("Update failed", String(e));
    }
  }

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
    setHiggsfieldApiKey(settings.higgsfieldApiKey);
    setHiggsfieldApiSecret(settings.higgsfieldApiSecret);
  }, [
    settings.apiEndpoint,
    settings.apiKey,
    settings.modelId,
    settings.imgbbApiKey,
    settings.higgsfieldApiKey,
    settings.higgsfieldApiSecret,
  ]);

  async function handleSave() {
    setSaving(true);
    try {
      await settings.set("api_endpoint", endpoint);
      await settings.set("api_key", apiKey);
      await settings.set("model_id", modelId);
      await settings.set("imgbb_api_key", imgbbApiKey);
      await settings.set("higgsfield_api_key", higgsfieldApiKey);
      await settings.set("higgsfield_api_secret", higgsfieldApiSecret);
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

      {/* Higgsfield (Soul 2.0) — Character Creator */}
      <Panel className="p-6">
        <div className="flex items-center gap-2 mb-5">
          <UserCog className="w-4 h-4 text-hud-cyan" strokeWidth={1.5} />
          <h2 className="hud-label text-fg">Higgsfield (Character Creator)</h2>
        </div>

        <p className="font-mono text-[0.65rem] text-fg-muted mb-4 leading-relaxed">
          Used by the <span className="text-hud-cyan">UGC Character Creator</span>{" "}
          to generate photoreal portraits via Soul 2.0. Get your credentials at{" "}
          <a
            href="https://cloud.higgsfield.ai/"
            target="_blank"
            rel="noreferrer"
            className="text-hud-cyan hover:underline"
          >
            cloud.higgsfield.ai
          </a>
          . Both the API key and secret are required.
        </p>

        <div className="grid grid-cols-1 gap-4">
          <HudInput
            label="Higgsfield API Key"
            type="password"
            mono
            value={higgsfieldApiKey}
            onChange={(e) => setHiggsfieldApiKey(e.target.value)}
            placeholder="hf_…"
          />
          <HudInput
            label="Higgsfield API Secret"
            type="password"
            mono
            value={higgsfieldApiSecret}
            onChange={(e) => setHiggsfieldApiSecret(e.target.value)}
            placeholder="hf_secret_…"
            hint="Sent as the hf-secret header alongside the API key. Save to apply."
          />
        </div>

        {higgsfieldApiKey && higgsfieldApiSecret && (
          <p className="font-mono text-[0.6rem] text-hud-green mt-3">
            ✓ Higgsfield credentials configured
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

      {/* Updates */}
      {isTauri && (
        <Panel className="p-6">
          <div className="flex items-center gap-2 mb-5">
            <Download className="w-4 h-4 text-hud-cyan" strokeWidth={1.5} />
            <h2 className="hud-label text-fg">Updates</h2>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-5">
            <div>
              <div className="hud-label text-fg-dim mb-1">Current Version</div>
              <div className="font-mono text-sm text-fg">
                v{currentVersion || "…"}
              </div>
            </div>
            <div>
              <div className="hud-label text-fg-dim mb-1">Channel</div>
              <div className="font-mono text-sm text-fg">stable · GitHub</div>
            </div>
          </div>

          {updateState.phase === "available" && (
            <div className="border border-hud-cyan/40 bg-hud-cyan/5 px-4 py-3 mb-4">
              <div className="hud-label text-hud-cyan mb-1">
                Update available — v{updateState.update.version}
              </div>
              {updateState.update.body && (
                <p className="font-mono text-[0.7rem] text-fg-muted whitespace-pre-wrap leading-relaxed max-h-40 overflow-auto">
                  {updateState.update.body}
                </p>
              )}
            </div>
          )}

          {updateState.phase === "uptodate" && (
            <div className="border border-hud-green/40 bg-hud-green/5 px-4 py-2.5 mb-4 flex items-center gap-2">
              <CheckCircle className="w-3.5 h-3.5 text-hud-green" />
              <span className="font-mono text-[0.7rem] text-fg-muted">
                You're on the latest version.
              </span>
            </div>
          )}

          {updateState.phase === "downloading" && (
            <div className="border border-hud-cyan/40 bg-hud-cyan/5 px-4 py-3 mb-4">
              <div className="hud-label text-hud-cyan mb-2">Downloading…</div>
              <div className="h-1.5 bg-fg-dim/20 overflow-hidden">
                <div
                  className="h-full bg-hud-cyan transition-all"
                  style={{
                    width:
                      updateState.total
                        ? `${Math.min(100, (updateState.downloaded / updateState.total) * 100)}%`
                        : "30%",
                  }}
                />
              </div>
              <div className="font-mono text-[0.6rem] text-fg-muted mt-1.5">
                {(updateState.downloaded / 1024 / 1024).toFixed(1)} MB
                {updateState.total
                  ? ` / ${(updateState.total / 1024 / 1024).toFixed(1)} MB`
                  : ""}
              </div>
            </div>
          )}

          {updateState.phase === "installing" && (
            <div className="border border-hud-amber/40 bg-hud-amber/5 px-4 py-2.5 mb-4 font-mono text-[0.7rem] text-hud-amber">
              Installing update…
            </div>
          )}

          {updateState.phase === "ready" && (
            <div className="border border-hud-green/40 bg-hud-green/5 px-4 py-2.5 mb-4 font-mono text-[0.7rem] text-hud-green">
              Update installed. Restarting…
            </div>
          )}

          {updateState.phase === "error" && (
            <div className="border border-hud-red/40 bg-hud-red/5 px-4 py-2.5 mb-4 font-mono text-[0.7rem] text-hud-red">
              {updateState.message}
            </div>
          )}

          <div className="flex items-center gap-3">
            {updateState.phase === "available" ? (
              <Button
                variant="primary"
                iconLeft={<Download className="w-3.5 h-3.5" />}
                onClick={() => void handleInstallUpdate()}
              >
                Download & Install
              </Button>
            ) : (
              <Button
                variant="secondary"
                loading={updateState.phase === "checking"}
                disabled={
                  updateState.phase === "downloading" ||
                  updateState.phase === "installing" ||
                  updateState.phase === "ready"
                }
                iconLeft={<RefreshCw className="w-3.5 h-3.5" />}
                onClick={() => void handleCheckForUpdate()}
              >
                Check for Updates
              </Button>
            )}
            <p className="font-mono text-[0.65rem] text-fg-muted">
              Updates are signed and verified. Source:{" "}
              <a
                href="https://github.com/LaurynasGargasas/oneclick-studio/releases"
                target="_blank"
                rel="noreferrer"
                className="text-hud-cyan hover:underline"
              >
                GitHub Releases
              </a>
            </p>
          </div>
        </Panel>
      )}

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
              Adds a OneClick Studio .lnk to your Windows desktop.
            </p>
          </div>
        </Panel>
      )}
    </div>
  );
}
