import { useRef, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { Play, Pause, Volume2, VolumeX, Download, ExternalLink, AlertCircle, RefreshCw } from "lucide-react";
import { Modal, StatusBadge, Button } from "@/components/hud";
import { isTauri } from "@/lib/tauri";
import { relativeTime } from "@/lib/relativeTime";
import { useGenerations } from "@/stores/generationsStore";
import { useSettings } from "@/stores/settingsStore";
import type { Generation } from "@/stores/generationsStore";

interface Props {
  generation: Generation | null;
  onClose: () => void;
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
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [videoError, setVideoError] = useState(false);

  if (!g) return null;

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
                  onEnded={() => setPlaying(false)}
                  onError={() => setVideoError(true)}
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

          {/* Download button (Tauri local file only) */}
          {g.status === "completed" && g.video_path && !isRemoteUrl && (
            <div className="p-3 border-t border-border-hud flex justify-end">
              <Button
                variant="secondary"
                size="sm"
                iconLeft={<Download className="w-3.5 h-3.5" />}
                onClick={() => {
                  if (isTauri) {
                    // Open file location using the opener plugin
                    import("@tauri-apps/plugin-opener").then(({ openPath }) => {
                      void openPath(g.video_path!);
                    }).catch(console.warn);
                  }
                }}
              >
                Open File
              </Button>
            </div>
          )}
          {g.status === "completed" && isRemoteUrl && (
            <div className="p-3 border-t border-border-hud flex justify-end">
              <Button
                variant="secondary"
                size="sm"
                iconLeft={<ExternalLink className="w-3.5 h-3.5" />}
                onClick={() => window.open(g.video_path!, "_blank")}
              >
                Open in Browser
              </Button>
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
            <div className="hud-label text-fg-dim mb-2">// Prompt</div>
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
              <InfoRow label="Watermark" value={g.watermark ? "Yes" : "No"} />
              <InfoRow label="Audio" value={g.audio_enabled ? "Enabled" : "Disabled"} />
              {g.task_id && <InfoRow label="Task ID" value={g.task_id} />}
              {g.completed_at && (
                <InfoRow
                  label="Completed"
                  value={new Date(g.completed_at).toLocaleTimeString()}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
