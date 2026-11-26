import React from 'react';
import { AlertTriangle, CheckCircle2, Cpu, Download, Film } from 'lucide-react';
import { getOutputDimensions } from '../constants/presets';
import type {
  AspectRatioId,
  BitrateQuality,
  ExportSettings,
  FrameRateOption,
  ResolutionTier,
  WebCodecsCapability,
} from '../types/studio';

interface ExportTabProps {
  aspectRatio: AspectRatioId;
  settings: ExportSettings;
  duration: number;
  canExport: boolean;
  isExporting: boolean;
  capability: WebCodecsCapability | null;
  onChange: (next: ExportSettings) => void;
  onStartExport: () => void;
}

export const ExportTab: React.FC<ExportTabProps> = ({
  aspectRatio,
  settings,
  duration,
  canExport,
  isExporting,
  capability,
  onChange,
  onStartExport,
}) => {
  const { width, height } = getOutputDimensions(aspectRatio, settings.resolution);
  const totalFrames = duration > 0 ? Math.ceil(duration * settings.fps) : 0;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-xs font-bold text-slate-200">ตั้งค่าการส่งออก MP4 ออฟไลน์</h3>
        <p className="text-[11px] text-slate-400 mt-0.5">
          เรนเดอร์ทีละเฟรมด้วย WebCodecs + Mediabunny ไม่ใช้วิธีอัดหน้าจอ
        </p>
      </div>

      {/* Resolution */}
      <div className="rounded-xl bg-[#141926] border border-slate-800/80 p-3.5 space-y-3.5">
        <div className="space-y-1.5">
          <div className="text-xs font-medium text-slate-300">ความละเอียดวิดีโอ</div>
          <div className="grid grid-cols-2 gap-2">
            {(['1080p', '720p'] as ResolutionTier[]).map((res) => (
              <button
                key={res}
                type="button"
                onClick={() => onChange({ ...settings, resolution: res })}
                className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                  settings.resolution === res
                    ? 'bg-cyan-500/20 text-cyan-200 border-cyan-400'
                    : 'bg-[#0E121B] text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
              >
                {res === '1080p' ? '1080p (Full HD)' : '720p (HD)'}
              </button>
            ))}
          </div>
        </div>

        {/* Frame Rate */}
        <div className="space-y-1.5">
          <div className="text-xs font-medium text-slate-300">เฟรมเรต (FPS)</div>
          <div className="grid grid-cols-2 gap-2">
            {([60, 30] as FrameRateOption[]).map((fps) => (
              <button
                key={fps}
                type="button"
                onClick={() => onChange({ ...settings, fps })}
                className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                  settings.fps === fps
                    ? 'bg-cyan-500/20 text-cyan-200 border-cyan-400'
                    : 'bg-[#0E121B] text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
              >
                {fps} FPS {fps === 60 ? '(ลื่นไหล)' : '(เรนเดอร์ไว)'}
              </button>
            ))}
          </div>
        </div>

        {/* Bitrate Quality */}
        <div className="space-y-1.5">
          <div className="text-xs font-medium text-slate-300">คุณภาพบิตเรต</div>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ['high', 'สูง (คมชัดพิเศษ)'],
                ['standard', 'มาตรฐาน (ไฟล์เบา)'],
              ] as [BitrateQuality, string][]
            ).map(([q, label]) => (
              <button
                key={q}
                type="button"
                onClick={() => onChange({ ...settings, bitrateQuality: q })}
                className={`py-2 px-2.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                  settings.bitrateQuality === q
                    ? 'bg-cyan-500/20 text-cyan-200 border-cyan-400'
                    : 'bg-[#0E121B] text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Render Specs Summary */}
      <div className="rounded-xl bg-[#141926] border border-slate-800/80 p-3.5 space-y-2 text-xs">
        <div className="flex items-center gap-1.5 font-semibold text-slate-200">
          <Film className="w-3.5 h-3.5 text-cyan-300" />
          <span>ข้อมูลไฟล์ผลลัพธ์</span>
        </div>
        <div className="grid grid-cols-2 gap-y-1.5 text-[11px]">
          <span className="text-slate-400">ขนาดเฟรมจริง:</span>
          <span className="font-mono text-right text-slate-200">
            {width} × {height} px
          </span>
          <span className="text-slate-400">จำนวนเฟรมทั้งหมด:</span>
          <span className="font-mono text-right text-slate-200">
            {totalFrames > 0 ? `${totalFrames.toLocaleString()} เฟรม` : '—'}
          </span>
          <span className="text-slate-400">รูปแบบวิดีโอ / เสียง:</span>
          <span className="font-mono text-right text-cyan-300">
            MP4 (H.264 + {capability?.aacSupported ? 'AAC' : 'Opus'})
          </span>
        </div>
      </div>

      {/* WebCodecs Hardware Diagnostics */}
      {capability && (
        <div
          className={`rounded-xl border p-3 text-[11px] space-y-1.5 ${
            capability.supported
              ? 'bg-emerald-500/8 border-emerald-500/25 text-emerald-200'
              : 'bg-amber-500/10 border-amber-500/30 text-amber-200'
          }`}
        >
          <div className="flex items-center gap-1.5 font-semibold">
            {capability.supported ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            )}
            <span>
              {capability.supported
                ? 'เบราว์เซอร์พร้อมเรนเดอร์ WebCodecs Offline'
                : 'ตรวจพบข้อจำกัด WebCodecs'}
            </span>
          </div>
          {capability.reason ? (
            <p className="text-amber-200/90 leading-snug">{capability.reason}</p>
          ) : (
            <div className="flex items-center gap-1.5 text-slate-400">
              <Cpu className="w-3 h-3 shrink-0" />
              <span>
                H.264 ({capability.h264Supported ? 'พร้อม' : 'ไม่รองรับ'}) •{' '}
                {capability.aacSupported ? 'AAC' : capability.opusSupported ? 'Opus' : 'ไม่รองรับเสียง'}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Primary Render Button */}
      <button
        type="button"
        disabled={!canExport || isExporting || (capability !== null && !capability.supported)}
        onClick={onStartExport}
        className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all cursor-pointer ${
          canExport && !isExporting && (!capability || capability.supported)
            ? 'bg-gradient-to-r from-cyan-500 via-blue-500 to-violet-600 text-white shadow-lg shadow-cyan-500/20 hover:brightness-110 active:scale-[0.99]'
            : 'bg-slate-800 text-slate-500 cursor-not-allowed'
        }`}
      >
        <Download className="w-4 h-4" />
        <span>{isExporting ? 'กำลังเรนเดอร์วิดีโอ...' : 'เริ่มเรนเดอร์ไฟล์ MP4'}</span>
      </button>
    </div>
  );
};
