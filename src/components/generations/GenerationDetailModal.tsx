import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { convertFileSrc } from "@tauri-apps/api/core";
import { save as saveDialog } from "@tauri-apps/plugin-dialog";
import { openPath } from "@tauri-apps/plugin-opener";
import { Play, Pause, Volume2, VolumeX, ExternalLink, AlertCircle, RefreshCw, Trash2, Wand2, Copy, Check, Download } from "lucide-react";
import { Modal, StatusBadge, Button } from "@/components/hud";
import { isTauri } from "@/lib/tauri";
import { relativeTime } from "@/lib/relativeTime";
import { useGenerations } from "@/stores/generationsStore";
import { useSettings } from "@/stores/settingsStore";
import { toast } from "@/stores/toastStore";
import type { Generation } from "@/stores/generationsStore";

interface Props {
  generation: Generation | null;
  onClose: () => void;
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function toVideoSrc(path: string): string {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  if (isTauri) return convertFileSrc(path);
  return path;
}

function InfoRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value === null || value === undefined) return null;
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5 border-b border-border-hud/40">
      <span className="hud-label text-fg-dim shrink-0">{label}</span>
      <span className="font-mono text-xs text-fg text-right truncate">{String(value)}</span>
    </div>
  );
}

function CompletedNoVideo({ generation }: { generation: Generation }) {
  const poll = useGenerations((s) => s.poll);
  const _updateLocal = useGenerations((s) => s._updateLocal);
  const settings = useSettings();
  const [repolling, setRepolling] = useState(false);

  async function handleRepoll() {
    if (!generation.task_id) return;
    setRepolling(true);
    // Reset status so polling re-runs
    _updateLocal(generation.id, { status: "processing" });
    try {
      await poll(generation.id, {
        endpoint: settings.apiEndpoint,
        api_key: settings.apiKey,
      });
    } finally {
      setRepolling(false);
    }
  }

  return (
    <div className="absolute inset-0 hud-grid-bg flex flex-col items-center justify-center gap-4 px-6 text-center">
      <AlertCircle className="w-8 h-8 text-hud-amber" strokeWidth={1.5} />
      <div className="hud-label text-hud-amber">Video URL Missing</div>
      <p className="font-mono text-[0.6rem] text-fg-muted leading-relaxed max-w-xs">
        The API returned success but no video URL was found in the response.
        Click Re-fetch to poll the task again with the updated extractor.
      </p>
      <Button
        variant="secondary"
        size="sm"
        loading={repolling}
        iconLeft={<RefreshCw className="w-3.5 h-3.5" />}
        onClick={handleRepoll}
      >
        Re-fetch Video
      </Button>
    </div>
  );
}

export function GenerationDetailModal({ generation: g, onClose }: Props) {
  const navigate = useNavigate();
  const remove = useGenerations((s) => s.remove);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  async function handleDownload() {
    if (!g?.video_path) return;
    const shortId = g.id.slice(0, 8);
    const dest = await saveDialog({
      defaultPath: `seedance-${shortId}.mp4`,
      filters: [{ name: "Video", extensions: ["mp4"] }],
    });
    if (!dest) return; // user cancelled
    setDownloading(true);
    try {
      await invoke("save_video_to_path", { src: g.video_path, dest });
      toast.success("Video saved", dest as string);
      await openPath(dest as string);
    } catch (e) {
      toast.error("Save failed", String(e));
    } finally {
      setDownloading(false);
    }
  }

  function handleCopyPrompt() {
    if (!g) return;
    void navigator.clipboard.writeText(g.prompt_raw);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // Space to play/pause
  useEffect(() => {
    if (!g) return;
    function onKey(e: KeyboardEvent) {
      if (e.code === "Space" && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        togglePlay();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Reset state when generation changes
  useEffect(() => {
    setDeleteConfirm(false);
    setCurrentTime(0);
    setDuration(0);
    setPlaying(false);
  }, [g?.id]);

  if (!g) return null;

  async function handleDelete() {
    if (!deleteConfirm) { setDeleteConfirm(true); return; }
    onClose();
    await remove(g!.id);
  }

  function handleRegenerate() {
    onClose();
    navigate("/generate", {
      state: {
        draft: {
          prompt: g!.prompt_raw,
          duration: g!.duration_s,
          resolution: g!.resolution,
          aspectRatio: g!.aspect_ratio,
          audioEnabled: g!.audio_enabled,
          cameraFixed: g!.camera_fixed,
          seed: g!.seed !== null ? String(g!.seed) : "",
        },
      },
    });
  }

  const videoSrc = g.video_path ? toVideoSrc(g.video_path) : null;
  const isRemoteUrl = g.video_path?.startsWith("http");

  function togglePlay() {
    if (!videoRef.current) return;
    if (playing) {
      videoRef.current.pause();
    } else {
      void videoRef.current.play();
    }
    setPlaying((p) => !p);
  }

  function toggleMute() {
    if (!videoRef.current) return;
    videoRef.current.muted = !muted;
    setMuted((m) => !m);
  }

  return (
    <Modal
      open={!!g}
      onClose={onClose}
      title="Generation"
      subtitle="// Output"
      size="xl"
    >
      <div className="flex flex-col lg:flex-row">
        {/* Video panel */}
        <div className="lg:w-3/5 bg-bg-base flex flex-col">
          <div className="relative aspect-video bg-bg-elevated flex-shrink-0">
            {g.status === "completed" && videoSrc && !videoError ? (
              <>
                <video
                  ref={videoRef}
                  src={videoSrc}
                  className="w-full h-full object-contain"
                  onPlay={() => setPlaying(true)}
                  onPause={() => setPlaying(false)}
                  onEnded={() => { setPlaying(false); setCurrentTime(0); }}
                  onError={() => setVideoError(true)}
                  onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime ?? 0)}
                  onLoadedMetadata={() => setDuration(videoRef.current?.duration ?? 0)}
                  loop
                />
                {/* Controls overlay */}
                <div className="absolute bottom-0 left-0 right-0 p-3 flex items-center gap-3 bg-gradient-to-t from-bg-base/80 to-transparent opacity-0 hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={togglePlay}
                    className="w-8 h-8 border border-hud-cyan flex items-center justify-center text-hud-cyan hover:bg-hud-cyan/10 transition-colors"
                  >
                    {playing
                      ? <Pause className="w-4 h-4" fill="currentColor" />
                      : <Play className="w-4 h-4 ml-0.5" fill="currentColor" />
                    }
                  </button>
                  <button
                    type="button"
                    onClick={toggleMute}
                    className="w-8 h-8 border border-border-hud flex items-center justify-center text-fg-muted hover:text-hud-cyan hover:border-hud-cyan transition-colors"
                  >
                    {muted
                      ? <VolumeX className="w-4 h-4" />
                      : <Volume2 className="w-4 h-4" />
                    }
                  </button>
                  <div className="flex-1" />
                  {isRemoteUrl && (
                    <a
                      href={g.video_path!}
                      target="_blank"
                      rel="noreferrer"
                      className="w-8 h-8 border border-border-hud flex items-center justify-center text-fg-muted hover:text-hud-cyan hover:border-hud-cyan transition-colors"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
                {/* Click to play */}
                {!playing && (
                  <button
                    type="button"
                    onClick={togglePlay}
                    className="absolute inset-0 flex items-center justify-center group"
                    aria-label="Play"
                  >
                    <div className="w-16 h-16 border border-hud-cyan flex items-center justify-center bg-bg-base/60 group-hover:bg-hud-cyan/10 transition-colors">
                      <Play className="w-7 h-7 text-hud-cyan ml-1" fill="currentColor" />
                    </div>
                  </button>
                )}

                {/* Timeline scrubber */}
                {duration > 0 && (
                  <div className="absolute bottom-0 left-0 right-0 z-10">
                    {/* Time labels */}
                    <div className="flex justify-between px-2 pb-0.5">
                      <span className="font-mono text-[0.55rem] text-fg-muted tabular-nums">
                        {formatTime(currentTime)}
                      </span>
                      <span className="font-mono text-[0.55rem] text-fg-dim tabular-nums">
                        {formatTime(duration)}
                      </span>
                    </div>
                    {/* Track */}
                    <div
                      className="relative h-1.5 bg-bg-elevated/80 cursor-pointer group/timeline mx-0"
                      onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const ratio = (e.clientX - rect.left) / rect.width;
                        if (videoRef.current) {
                          videoRef.current.currentTime = Math.max(0, Math.min(ratio * duration, duration));
                        }
                      }}
                    >
                      {/* Progress fill */}
                      <div
                        className="h-full bg-hud-cyan transition-none"
                        style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                      />
                      {/* Thumb */}
                      <div
                        className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-hud-cyan border border-bg-base rounded-full -ml-1.5 opacity-0 group-hover/timeline:opacity-100 transition-opacity"
                        style={{ left: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                )}
              </>
            ) : g.status === "failed" ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-8 text-center">
                <AlertCircle className="w-10 h-10 text-hud-red" strokeWidth={1.5} />
                <p className="font-mono text-xs text-hud-red/80 leading-relaxed">
                  {g.error_message ?? "Generation failed"}
                </p>
              </div>
            ) : g.status === "completed" ? (
              // Completed but no video URL — add re-poll button
              <CompletedNoVideo generation={g} />
            ) : (
              <div className="absolute inset-0 hud-grid-bg flex flex-col items-center justify-center gap-3">
                <div className="hud-label text-hud-amber hud-pulse">
                  {g.status === "pending" ? "Queued…" : "Rendering…"}
                </div>
                <p className="font-mono text-[0.65rem] text-fg-muted">Video will appear here when ready</p>
              </div>
            )}
          </div>

          {/* Download / open buttons */}
          {g.status === "completed" && g.video_path && (
            <div className="p-3 border-t border-border-hud flex items-center justify-end gap-2">
              {isTauri && (
                <Button
                  variant="secondary"
                  size="sm"
                  loading={downloading}
                  iconLeft={<Download className="w-3.5 h-3.5" />}
                  onClick={() => void handleDownload()}
                >
                  Save Video
                </Button>
              )}
              {isRemoteUrl && (
                <Button
                  variant="secondary"
                  size="sm"
                  iconLeft={<ExternalLink className="w-3.5 h-3.5" />}
                  onClick={() => window.open(g.video_path!, "_blank")}
                >
                  Open URL
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Details panel */}
        <div className="lg:w-2/5 border-t lg:border-t-0 lg:border-l border-border-hud p-5 overflow-y-auto space-y-4">
          <div>
            <div className="hud-label text-fg-dim mb-2">// Status</div>
            <div className="flex items-center gap-3">
              <StatusBadge status={g.status} />
              <span className="font-mono text-[0.65rem] text-fg-dim">
                {relativeTime(g.created_at)}
              </span>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="hud-label text-fg-dim">// Prompt</div>
              <button
                type="button"
                onClick={handleCopyPrompt}
                className="flex items-center gap-1 font-mono text-[0.6rem] text-fg-dim hover:text-hud-cyan transition-colors"
                title="Copy prompt"
              >
                {copied
                  ? <><Check className="w-3 h-3 text-hud-cyan" /> Copied</>
                  : <><Copy className="w-3 h-3" /> Copy</>
                }
              </button>
            </div>
            <p className="font-mono text-xs text-fg leading-relaxed bg-bg-elevated/40 border border-border-hud/40 p-3">
              {g.prompt_raw}
            </p>
          </div>

          <div>
            <div className="hud-label text-fg-dim mb-2">// Parameters</div>
            <div className="space-y-0">
              <InfoRow label="Resolution" value={g.resolution} />
              <InfoRow label="Duration" value={`${g.duration_s}s`} />
              <InfoRow label="Aspect Ratio" value={g.aspect_ratio} />
              <InfoRow label="Quality" value={g.quality} />
              {g.seed !== null && <InfoRow label="Seed" value={g.seed} />}
              <InfoRow label="Camera Fixed" value={g.camera_fixed ? "Yes" : "No"} />
              <InfoRow label="Audio" value={g.audio_enabled ? "Enabled" : "Disabled"} />
              {g.cost_credits !== null && g.cost_credits !== undefined && (
                <InfoRow
                  label="Tokens Used"
                  value={g.cost_credits >= 1000
                    ? `${(g.cost_credits / 1000).toFixed(1)}K`
                    : String(g.cost_credits)}
                />
              )}
              {g.task_id && <InfoRow label="Task ID" value={g.task_id} />}
              {g.completed_at && (
                <InfoRow
                  label="Completed"
                  value={new Date(g.completed_at).toLocaleTimeString()}
                />
              )}
            </div>
          </div>
          {/* Actions */}
          <div className="pt-2 border-t border-border-hud flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              iconLeft={<Wand2 className="w-3.5 h-3.5" />}
              onClick={handleRegenerate}
              className="flex-1"
            >
              Re-generate
            </Button>
            <Button
              variant="secondary"
              size="sm"
              iconLeft={<Trash2 className="w-3.5 h-3.5" />}
              onClick={() => void handleDelete()}
              className={deleteConfirm ? "border-hud-red text-hud-red hover:bg-hud-red/10" : ""}
            >
              {deleteConfirm ? "Confirm Delete" : "Delete"}
            </Button>
            {deleteConfirm && (
              <button
                type="button"
                className="font-mono text-[0.6rem] text-fg-dim hover:text-fg transition-colors shrink-0"
                onClick={() => setDeleteConfirm(false)}
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
