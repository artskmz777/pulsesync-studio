import React, { useRef, useState } from 'react';
import {
  CheckCircle2,
  Film,
  Image as ImageIcon,
  Loader2,
  Music,
  RefreshCw,
  Sparkles,
  Trash2,
  Upload,
  AlertCircle,
} from 'lucide-react';
import { SliderControl, SwitchControl } from './StudioControls';
import type {
  AnalysisSummary,
  AudioSourceMode,
  ImageFitMode,
  MediaSourceState,
} from '../types/studio';

interface MediaPanelProps {
  media: MediaSourceState;
  analysisSummary: AnalysisSummary;
  liveBassMeter: number;
  liveMelodicMeter: number;
  isDemoLoading: boolean;
  onSelectBackgroundFile: (file: File) => void;
  onClearBackground: () => void;
  onSelectAudioFile: (file: File) => void;
  onClearAudio: () => void;
  onChangeImageFit: (fit: ImageFitMode) => void;
  onChangeBleed: (bleed: number) => void;
  onChangeLoopVideo: (loop: boolean) => void;
  onChangeAudioSourceMode: (mode: AudioSourceMode) => void;
  onLoadDemo: () => void;
}

function formatDurationTh(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export const MediaPanel: React.FC<MediaPanelProps> = ({
  media,
  analysisSummary,
  liveBassMeter,
  liveMelodicMeter,
  isDemoLoading,
  onSelectBackgroundFile,
  onClearBackground,
  onSelectAudioFile,
  onClearAudio,
  onChangeImageFit,
  onChangeBleed,
  onChangeLoopVideo,
  onChangeAudioSourceMode,
  onLoadDemo,
}) => {
  const bgInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const [dragTarget, setDragTarget] = useState<'bg' | 'audio' | null>(null);

  const handleDrop = (e: React.DragEvent, target: 'bg' | 'audio') => {
    e.preventDefault();
    setDragTarget(null);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    if (target === 'bg') {
      onSelectBackgroundFile(file);
    } else {
      onSelectAudioFile(file);
    }
  };

  const renderStatusBadge = () => {
    switch (analysisSummary.status) {
      case 'ready':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-300">
            <CheckCircle2 className="w-3.5 h-3.5" />
            พร้อมใช้งาน
          </span>
        );
      case 'decoding':
      case 'analyzing':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-cyan-500/15 border border-cyan-500/30 px-2.5 py-0.5 text-[11px] font-semibold text-cyan-300">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            {analysisSummary.progress}%
          </span>
        );
      case 'error':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 border border-rose-500/30 px-2.5 py-0.5 text-[11px] font-semibold text-rose-300">
            <AlertCircle className="w-3.5 h-3.5" />
            ผิดพลาด
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center rounded-full bg-slate-800 border border-slate-700 px-2.5 py-0.5 text-[11px] text-slate-400">
            รอไฟล์เสียง
          </span>
        );
    }
  };

  const usingVideoAudio =
    media.backgroundType === 'video' &&
    media.videoHasAudio &&
    media.audioSourceMode === 'video';

  return (
    <aside className="w-full lg:w-[300px] xl:w-[320px] shrink-0 bg-[#10141F] border-r border-slate-800/90 flex flex-col overflow-y-auto">
      <div className="p-4 space-y-4">
        {/* Quick Demo Launcher */}
        <button
          type="button"
          onClick={onLoadDemo}
          disabled={isDemoLoading}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-slate-800 to-[#192136] hover:from-slate-700 hover:to-[#202b46] border border-cyan-500/25 px-3 py-2.5 text-xs font-semibold text-cyan-200 transition-all cursor-pointer disabled:opacity-60"
        >
          {isDemoLoading ? (
            <Loader2 className="w-4 h-4 animate-spin text-cyan-300" />
          ) : (
            <Sparkles className="w-4 h-4 text-cyan-300" />
          )}
          <span>{isDemoLoading ? 'กำลังสร้างตัวอย่าง...' : 'โหลดไฟล์ตัวอย่างทดสอบ (124 BPM)'}</span>
        </button>

        {/* Zone 1: Background Image / Video */}
        <section className="space-y-2.5">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              1. ไฟล์ภาพ / วิดีโอพื้นหลัง
            </h2>
            {media.backgroundType !== 'none' && (
              <button
                type="button"
                onClick={onClearBackground}
                className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-rose-300 cursor-pointer"
              >
                <Trash2 className="w-3 h-3" />
                ล้าง
              </button>
            )}
          </div>

          <input
            ref={bgInputRef}
            type="file"
            accept=".png,.jpg,.jpeg,.webp,.mp4,.webm,.mov,image/png,image/jpeg,image/webp,video/mp4,video/webm,video/quicktime"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onSelectBackgroundFile(file);
              e.target.value = '';
            }}
          />

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragTarget('bg');
            }}
            onDragLeave={() => setDragTarget(null)}
            onDrop={(e) => handleDrop(e, 'bg')}
            onClick={() => bgInputRef.current?.click()}
            className={`rounded-2xl border-2 border-dashed p-3.5 transition-all cursor-pointer ${
              dragTarget === 'bg'
                ? 'border-cyan-400 bg-cyan-500/10'
                : 'border-slate-700/80 bg-[#141926] hover:border-slate-500 hover:bg-[#171E2E]'
            }`}
          >
            {media.backgroundType === 'none' ? (
              <div className="text-center py-2 space-y-1.5">
                <div className="mx-auto w-9 h-9 rounded-xl bg-slate-800/80 flex items-center justify-center text-cyan-300">
                  <Upload className="w-4 h-4" />
                </div>
                <p className="text-xs font-medium text-slate-200">
                  ลากวางหรือคลิกเลือกภาพ / วิดีโอ
                </p>
                <p className="text-[11px] text-slate-500">
                  ภาพ: PNG, JPG, WEBP • วิดีโอ: MP4, WEBM, MOV
                </p>
              </div>
            ) : (
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center shrink-0 text-cyan-300">
                  {media.backgroundType === 'video' ? (
                    <Film className="w-5 h-5" />
                  ) : (
                    <ImageIcon className="w-5 h-5" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-white truncate">
                    {media.backgroundFileName}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5 font-mono">
                    {media.backgroundWidth}×{media.backgroundHeight}
                    {media.backgroundType === 'video' &&
                      ` • ${formatDurationTh(media.backgroundDuration)}`}
                  </div>
                  <div className="text-[11px] text-cyan-300 mt-1">คลิกเพื่อเปลี่ยนไฟล์</div>
                </div>
              </div>
            )}
          </div>

          {/* Image Options: Cover/Contain + Bleed Margin */}
          {media.backgroundType === 'image' && (
            <div className="rounded-xl bg-[#141926] border border-slate-800/80 p-3 space-y-3">
              <div className="grid grid-cols-2 gap-1.5">
                {(['cover', 'contain'] as const).map((fit) => (
                  <button
                    key={fit}
                    type="button"
                    onClick={() => onChangeImageFit(fit)}
                    className={`py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                      media.imageFit === fit
                        ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/40'
                        : 'bg-[#0E121B] text-slate-400 border border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    {fit === 'cover' ? 'เต็มกรอบ (Cover)' : 'พอดีกรอบ (Contain)'}
                  </button>
                ))}
              </div>
              <SliderControl
                label="เผื่อขอบกันภาพขาด (Bleed)"
                value={media.bleedPercent}
                min={10}
                max={18}
                unit="%"
                hint="เผื่อขอบ 10–15% เพื่อไม่ให้เห็นขอบดำเวลาภาพกระตุกตามเบส"
                onChange={onChangeBleed}
              />
            </div>
          )}

          {/* Video Options: Loop & Audio Track Source */}
          {media.backgroundType === 'video' && (
            <div className="rounded-xl bg-[#141926] border border-slate-800/80 p-3 space-y-2.5">
              <SwitchControl
                label="วนซ้ำวิดีโออัตโนมัติ (Loop)"
                description="หากวิดีโอสั้นกว่าไฟล์เสียง จะเล่นวนต่อเนื่อง"
                checked={media.loopVideo}
                onChange={onChangeLoopVideo}
              />

              <div className="space-y-1.5 pt-1">
                <div className="text-[11px] font-medium text-slate-400">แหล่งเสียงที่ใช้ซิงก์</div>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    disabled={!media.videoHasAudio}
                    onClick={() => onChangeAudioSourceMode('video')}
                    className={`py-1.5 px-2 rounded-lg text-[11px] font-medium transition-colors cursor-pointer ${
                      media.audioSourceMode === 'video' && media.videoHasAudio
                        ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/40'
                        : 'bg-[#0E121B] text-slate-400 border border-slate-800 disabled:opacity-40 disabled:cursor-not-allowed'
                    }`}
                  >
                    เสียงวิดีโอเดิม
                  </button>
                  <button
                    type="button"
                    onClick={() => onChangeAudioSourceMode('custom')}
                    className={`py-1.5 px-2 rounded-lg text-[11px] font-medium transition-colors cursor-pointer ${
                      media.audioSourceMode === 'custom' || !media.videoHasAudio
                        ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/40'
                        : 'bg-[#0E121B] text-slate-400 border border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    เสียงที่อัปโหลดแยก
                  </button>
                </div>
                {!media.videoHasAudio && (
                  <p className="text-[11px] text-amber-300/90">
                    วิดีโอนี้ไม่มีแทร็กเสียง กรุณาอัปโหลดไฟล์เสียงในข้อ 2
                  </p>
                )}
              </div>
            </div>
          )}
        </section>

        {/* Zone 2: Audio Track */}
        <section className="space-y-2.5">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              2. ไฟล์เสียงดนตรี
            </h2>
            {media.customAudioFile && (
              <button
                type="button"
                onClick={onClearAudio}
                className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-rose-300 cursor-pointer"
              >
                <Trash2 className="w-3 h-3" />
                ล้าง
              </button>
            )}
          </div>

          <input
            ref={audioInputRef}
            type="file"
            accept=".mp3,.wav,.ogg,.m4a,.flac,audio/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onSelectAudioFile(file);
              e.target.value = '';
            }}
          />

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragTarget('audio');
            }}
            onDragLeave={() => setDragTarget(null)}
            onDrop={(e) => handleDrop(e, 'audio')}
            onClick={() => audioInputRef.current?.click()}
            className={`rounded-2xl border-2 border-dashed p-3.5 transition-all cursor-pointer ${
              dragTarget === 'audio'
                ? 'border-violet-400 bg-violet-500/10'
                : 'border-slate-700/80 bg-[#141926] hover:border-slate-500 hover:bg-[#171E2E]'
            }`}
          >
            {media.customAudioFile ? (
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-violet-500/15 border border-violet-500/30 flex items-center justify-center shrink-0 text-violet-300">
                  <Music className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-white truncate">
                    {media.customAudioFileName}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5 font-mono">
                    {analysisSummary.duration > 0
                      ? `${formatDurationTh(analysisSummary.duration)} • ${(analysisSummary.sampleRate / 1000).toFixed(1)} kHz`
                      : 'กำลังอ่านข้อมูลเสียง...'}
                  </div>
                  <div className="text-[11px] text-violet-300 mt-1 flex items-center gap-1">
                    <RefreshCw className="w-3 h-3" />
                    คลิกเพื่อเปลี่ยนเพลง
                  </div>
                </div>
              </div>
            ) : usingVideoAudio ? (
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0 text-emerald-300">
                  <Music className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-emerald-200">
                    ใช้เสียงจากไฟล์วิดีโอเดิม
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    หรือลากไฟล์เสียงใหม่มาวางที่นี่เพื่อแทนที่
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-2 space-y-1.5">
                <div className="mx-auto w-9 h-9 rounded-xl bg-slate-800/80 flex items-center justify-center text-violet-300">
                  <Music className="w-4 h-4" />
                </div>
                <p className="text-xs font-medium text-slate-200">
                  ลากวางหรือคลิกเลือกไฟล์เสียง
                </p>
                <p className="text-[11px] text-slate-500">
                  รองรับ MP3, WAV, OGG, M4A, FLAC
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Zone 3: Pre-Analysis DSP Telemetry */}
        <section className="rounded-2xl bg-[#141926] border border-slate-800/90 p-3.5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-slate-200">สถานะวิเคราะห์คลื่นเสียง</span>
            {renderStatusBadge()}
          </div>

          <p className="text-[11px] text-slate-400 leading-relaxed">
            {analysisSummary.statusLabel}
          </p>

          {(analysisSummary.status === 'decoding' || analysisSummary.status === 'analyzing') && (
            <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cyan-400 to-violet-500 transition-all duration-150"
                style={{ width: `${analysisSummary.progress}%` }}
              />
            </div>
          )}

          {analysisSummary.status === 'error' && analysisSummary.errorMessage && (
            <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 p-2.5 text-[11px] text-rose-200">
              {analysisSummary.errorMessage}
            </div>
          )}

          {analysisSummary.status === 'ready' && (
            <>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="rounded-lg bg-[#0D111A] border border-slate-800/80 px-2.5 py-2">
                  <div className="text-slate-500">จังหวะโดยประมาณ</div>
                  <div className="font-mono font-semibold text-cyan-300 mt-0.5">
                    {analysisSummary.estimatedBpm > 0
                      ? `~${analysisSummary.estimatedBpm} BPM`
                      : 'ไม่คงที่'}
                  </div>
                </div>
                <div className="rounded-lg bg-[#0D111A] border border-slate-800/80 px-2.5 py-2">
                  <div className="text-slate-500">ตารางเฟรมวิเคราะห์</div>
                  <div className="font-mono font-semibold text-slate-200 mt-0.5">
                    {analysisSummary.totalFrames.toLocaleString()} เฟรม
                  </div>
                </div>
              </div>

              {/* Dual-band live DSP meters */}
              <div className="space-y-2 pt-1">
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-400">พลังเบส (20–140 Hz)</span>
                    <span className="font-mono text-cyan-300">{Math.round(liveBassMeter * 100)}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-[width] duration-75"
                      style={{ width: `${Math.round(liveBassMeter * 100)}%` }}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-400">คลื่นดนตรี (160 Hz–16 kHz)</span>
                    <span className="font-mono text-fuchsia-300">{Math.round(liveMelodicMeter * 100)}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-violet-400 to-fuchsia-500 transition-[width] duration-75"
                      style={{ width: `${Math.round(liveMelodicMeter * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </aside>
  );
};
