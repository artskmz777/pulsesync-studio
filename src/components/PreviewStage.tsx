import React, { useEffect, useRef, useState } from 'react';
import { Pause, Play, Volume2, VolumeX } from 'lucide-react';
import { getAspectRatioOption, getOutputDimensions } from '../constants/presets';
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
  const stageSlotRef = useRef<HTMLDivElement>(null);
  const [slotSize, setSlotSize] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });

  const { width, height } = getOutputDimensions(aspectRatio, exportSettings.resolution);
  const ratioMeta = getAspectRatioOption(aspectRatio);
  const activeStyle = VISUALIZER_STYLES.find((s) => s.id === visualizer.styleId);
  const activePalette = getGradientById(gradient.gradientId);

  // Measure available preview stage box so ANY aspect ratio (16:9, 3:2, 1:1, 4:5, 2:3, 9:16)
  // fits cleanly without clipping or overflowing width/height.
  useEffect(() => {
    const el = stageSlotRef.current;
    if (!el) return;

    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setSlotSize({ width: rect.width, height: rect.height });
      }
    };

    updateSize();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(updateSize);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const fittedFrameStyle = (() => {
    if (slotSize.width <= 0 || slotSize.height <= 0) {
      return {
        aspectRatio: `${width} / ${height}`,
        maxWidth: '100%',
        maxHeight: '100%',
      };
    }
    const scale = Math.min(slotSize.width / width, slotSize.height / height);
    return {
      width: `${Math.max(80, Math.floor(width * scale))}px`,
      height: `${Math.max(80, Math.floor(height * scale))}px`,
    };
  })();

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
    <main className="flex-1 min-w-0 min-h-[380px] lg:min-h-0 bg-[#0B0D12] flex flex-col justify-between overflow-hidden">
      {/* Stage Canvas Area */}
      <div className="flex-1 min-h-0 p-3 sm:p-4 lg:p-5 flex flex-col items-center justify-center relative gap-2.5">
        {/* Top Stage Info Chips */}
        <div className="w-full max-w-4xl flex items-center justify-between gap-2 text-[11px] shrink-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="rounded-lg bg-[#131722] border border-slate-800 px-2.5 py-1 font-mono text-slate-300 whitespace-nowrap shrink-0">
              {width} × {height} • {exportSettings.fps} FPS
            </span>
            <span className="hidden sm:inline-flex rounded-lg bg-[#131722] border border-slate-800 px-2 py-1 text-slate-300 whitespace-nowrap shrink-0">
              {ratioMeta.labelTh}
            </span>
            {activeStyle && (
              <span className="hidden xl:inline-flex items-center gap-1.5 rounded-lg bg-[#131722] border border-slate-800 px-2.5 py-1 text-slate-300 truncate">
                <span
                  className="w-2.5 h-2.5 rounded-sm shrink-0"
                  style={{
                    background: `linear-gradient(90deg, ${activePalette.colors[0]}, ${activePalette.colors[1]}, ${activePalette.colors[2]})`,
                  }}
                />
                <span className="truncate">{activeStyle.nameTh}</span>
              </span>
            )}
          </div>
          <span className="text-slate-500 hidden 2xl:inline whitespace-nowrap shrink-0">
            สัดส่วนพรีวิวตรงกับไฟล์ส่งออก 100%
          </span>
        </div>

        {/* Aspect-Locked Frame Container */}
        <div
          ref={stageSlotRef}
          className="flex-1 min-h-0 w-full flex items-center justify-center overflow-hidden"
        >
          <div
            className="relative rounded-xl overflow-hidden border border-slate-700/70 shadow-2xl shadow-black/70 bg-[#07090E] shrink-0"
            style={fittedFrameStyle}
          >
            <canvas
              ref={canvasRef}
              className="w-full h-full block"
            />
          </div>
        </div>
      </div>

      {/* Bottom Transport Bar */}
      <div className="shrink-0 border-t border-slate-800/90 bg-[#10141F]/95 px-3 sm:px-4 py-2.5 sm:py-3">
        <div className="max-w-4xl mx-auto flex flex-col gap-2">
          {/* Interactive Scrubber with Bass Beat Markers */}
          <div className="relative h-7 flex items-center group">
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
          <div className="flex items-center justify-between gap-2 sm:gap-3">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <button
                type="button"
                onClick={onTogglePlay}
                disabled={duration <= 0}
                className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-bold text-xs px-3 sm:px-4 py-2 whitespace-nowrap shrink-0 select-none transition-all cursor-pointer disabled:cursor-not-allowed"
              >
                {isPlaying ? (
                  <>
                    <Pause className="w-4 h-4 fill-current shrink-0" />
                    <span>หยุดชั่วคราว</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current shrink-0" />
                    <span>เล่นพรีวิว</span>
                  </>
                )}
              </button>

              <div className="font-mono text-[11px] sm:text-xs text-slate-300 tabular-nums whitespace-nowrap">
                <span className="text-white font-semibold">{formatTimecode(currentTime)}</span>
                <span className="text-slate-600 mx-1">/</span>
                <span className="text-slate-400">{formatTimecode(duration)}</span>
              </div>
            </div>

            {/* Volume */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <button
                type="button"
                onClick={onToggleMute}
                aria-label={isMuted ? 'เปิดเสียงพรีวิว' : 'ปิดเสียงพรีวิว'}
                className="p-1.5 rounded-lg text-slate-300 hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
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
                className="studio-slider w-16 sm:w-20 xl:w-24"
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
