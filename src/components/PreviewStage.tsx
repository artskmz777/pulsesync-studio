import React, { useEffect, useRef } from 'react';
import { Pause, Play, Volume2, VolumeX } from 'lucide-react';
import { getOutputDimensions } from '../constants/presets';
import { VISUALIZER_STYLES } from '../constants/visualizers';
import { getGradientById } from '../constants/gradients';
import type {
  AspectRatioId,
  ComputedAnalysis,
  ExportSettings,
  GradientSettings,
  VisualizerSettings,
} from '../types/studio';

interface PreviewStageProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  aspectRatio: AspectRatioId;
  exportSettings: ExportSettings;
  visualizer: VisualizerSettings;
  gradient: GradientSettings;
  analysis: ComputedAnalysis | null;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  volume: number;
  isMuted: boolean;
  onTogglePlay: () => void;
  onSeek: (timeSec: number) => void;
  onChangeVolume: (vol: number) => void;
  onToggleMute: () => void;
}

function formatTimecode(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '00:00.00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const cs = Math.floor((sec - Math.floor(sec)) * 100);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

export const PreviewStage: React.FC<PreviewStageProps> = ({
  canvasRef,
  aspectRatio,
  exportSettings,
  visualizer,
  gradient,
  analysis,
  currentTime,
  duration,
  isPlaying,
  volume,
  isMuted,
  onTogglePlay,
  onSeek,
  onChangeVolume,
  onToggleMute,
}) => {
  const timelineCanvasRef = useRef<HTMLCanvasElement>(null);
  const { width, height } = getOutputDimensions(aspectRatio, exportSettings.resolution);
  const activeStyle = VISUALIZER_STYLES.find((s) => s.id === visualizer.styleId);
  const activePalette = getGradientById(gradient.gradientId);

  // Draw beat energy markers behind the timeline scrubber
  useEffect(() => {
    const tc = timelineCanvasRef.current;
    if (!tc) return;
    const ctx = tc.getContext('2d');
    if (!ctx) return;

    const w = tc.width;
    const h = tc.height;
    ctx.clearRect(0, 0, w, h);

    if (!analysis || analysis.timelineBass.length === 0) return;
    const buckets = analysis.timelineBass;
    const barW = w / buckets.length;
    const progressRatio = duration > 0 ? Math.min(1, Math.max(0, currentTime / duration)) : 0;

    for (let i = 0; i < buckets.length; i++) {
      const val = buckets[i]!;
      const bh = Math.max(2, val * (h - 4));
      const x = i * barW;
      const ratio = i / buckets.length;
      ctx.fillStyle =
        ratio <= progressRatio ? 'rgba(34, 211, 238, 0.85)' : 'rgba(148, 163, 184, 0.25)';
      ctx.fillRect(x, h - bh, Math.max(1, barW - 1), bh);
    }
  }, [analysis, currentTime, duration]);

  const progressPct = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

  return (
    <main className="flex-1 min-w-0 bg-[#0B0D12] flex flex-col justify-between overflow-hidden">
      {/* Stage Canvas Area */}
      <div className="flex-1 min-h-0 p-4 sm:p-6 flex flex-col items-center justify-center relative">
        {/* Top Stage Info Chips */}
        <div className="w-full max-w-4xl flex flex-wrap items-center justify-between gap-2 mb-3 text-[11px]">
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-[#131722] border border-slate-800 px-2.5 py-1 font-mono text-slate-300">
              {width} × {height} • {exportSettings.fps} FPS
            </span>
            {activeStyle && (
              <span className="hidden sm:inline-flex items-center gap-1.5 rounded-lg bg-[#131722] border border-slate-800 px-2.5 py-1 text-slate-300">
                <span
                  className="w-2.5 h-2.5 rounded-sm"
                  style={{
                    background: `linear-gradient(90deg, ${activePalette.colors[0]}, ${activePalette.colors[1]}, ${activePalette.colors[2]})`,
                  }}
                />
                {activeStyle.nameTh}
              </span>
            )}
          </div>
          <span className="text-slate-500 hidden md:inline">
            กรอบพรีวิวจำลองสัดส่วนภาพส่งออกจริง 100%
          </span>
        </div>

        {/* Aspect-Locked Frame Container */}
        <div className="flex-1 min-h-0 w-full flex items-center justify-center">
          <div
            className="relative max-h-full max-w-full rounded-xl overflow-hidden border border-slate-700/70 shadow-2xl shadow-black/70 bg-[#07090E]"
            style={{
              aspectRatio: `${width} / ${height}`,
              height: aspectRatio === '9:16' ? '100%' : 'auto',
              width: aspectRatio === '16:9' ? '100%' : 'auto',
              maxHeight: '100%',
              maxWidth: '100%',
            }}
          >
            <canvas
              ref={canvasRef}
              className="w-full h-full block object-contain"
            />
          </div>
        </div>
      </div>

      {/* Bottom Transport Bar */}
      <div className="shrink-0 border-t border-slate-800/90 bg-[#10141F]/95 px-4 py-3">
        <div className="max-w-4xl mx-auto flex flex-col gap-2.5">
          {/* Interactive Scrubber with Bass Beat Markers */}
          <div className="relative h-8 flex items-center group">
            <canvas
              ref={timelineCanvasRef}
              width={720}
              height={28}
              className="w-full h-7 rounded-lg bg-[#0B0D12] border border-slate-800/80 pointer-events-none"
            />
            <input
              type="range"
              aria-label="เลื่อนเวลาพรีวิว"
              min={0}
              max={duration > 0 ? duration : 1}
              step={0.01}
              value={Math.min(currentTime, duration > 0 ? duration : 1)}
              disabled={duration <= 0}
              onChange={(e) => onSeek(Number(e.target.value))}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
            />
            {/* Playhead line */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_8px_rgba(255,255,255,0.9)] pointer-events-none"
              style={{ left: `${progressPct}%` }}
            />
          </div>

          {/* Controls Row */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onTogglePlay}
                disabled={duration <= 0}
                className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-bold text-xs px-4 py-2 whitespace-nowrap shrink-0 select-none transition-all cursor-pointer disabled:cursor-not-allowed"
              >
                {isPlaying ? (
                  <>
                    <Pause className="w-4 h-4 fill-current" />
                    <span>หยุดชั่วคราว</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current" />
                    <span>เล่นพรีวิว</span>
                  </>
                )}
              </button>

              <div className="font-mono text-xs text-slate-300 tabular-nums">
                <span className="text-white font-semibold">{formatTimecode(currentTime)}</span>
                <span className="text-slate-600 mx-1.5">/</span>
                <span className="text-slate-400">{formatTimecode(duration)}</span>
              </div>
            </div>

            {/* Volume */}
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onToggleMute}
                aria-label={isMuted ? 'เปิดเสียงพรีวิว' : 'ปิดเสียงพรีวิว'}
                className="p-1.5 rounded-lg text-slate-300 hover:bg-slate-800 transition-colors cursor-pointer"
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-4 h-4 text-slate-400" />
                ) : (
                  <Volume2 className="w-4 h-4 text-cyan-300" />
                )}
              </button>
              <input
                type="range"
                aria-label="ระดับเสียงพรีวิว"
                className="studio-slider w-20 sm:w-28"
                min={0}
                max={100}
                value={isMuted ? 0 : volume}
                onChange={(e) => onChangeVolume(Number(e.target.value))}
              />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
};
