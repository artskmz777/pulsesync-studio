import React from 'react';
import { AudioWaveform, Download, Monitor, Smartphone, Square, ShieldCheck } from 'lucide-react';
import { ASPECT_RATIO_OPTIONS } from '../constants/presets';
import type { AspectRatioId, WebCodecsCapability } from '../types/studio';

interface HeaderBarProps {
  aspectRatio: AspectRatioId;
  onChangeAspectRatio: (ratio: AspectRatioId) => void;
  canExport: boolean;
  isExporting: boolean;
  capability: WebCodecsCapability | null;
  onOpenExport: () => void;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  aspectRatio,
  onChangeAspectRatio,
  canExport,
  isExporting,
  capability,
  onOpenExport,
}) => {
  const getRatioIcon = (id: AspectRatioId) => {
    switch (id) {
      case '16:9':
        return <Monitor className="w-3.5 h-3.5" />;
      case '9:16':
        return <Smartphone className="w-3.5 h-3.5" />;
      case '1:1':
        return <Square className="w-3.5 h-3.5" />;
    }
  };

  return (
    <header className="h-14 shrink-0 border-b border-slate-800/90 bg-[#10141F]/95 backdrop-blur px-4 flex items-center justify-between gap-4">
      {/* Brand */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-400 via-violet-500 to-fuchsia-500 p-[1.5px] shadow-lg shadow-cyan-500/15 shrink-0">
          <div className="w-full h-full rounded-[10px] bg-[#0B0D12] flex items-center justify-center">
            <AudioWaveform className="w-5 h-5 text-cyan-300" />
          </div>
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-sm sm:text-base font-bold tracking-tight text-white truncate">
              PulseSync Studio
            </h1>
            <span className="hidden md:inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
              <ShieldCheck className="w-3 h-3" />
              ประมวลผลบนเครื่อง 100%
            </span>
          </div>
          <p className="text-[11px] text-slate-400 truncate hidden xl:block">
            ซิงก์จังหวะเบส &amp; คลื่นดนตรี • ส่งออก MP4 ออฟไลน์
          </p>
        </div>
      </div>

      {/* Aspect Ratio Selector */}
      <div className="hidden lg:flex items-center gap-1 bg-[#0B0D12] border border-slate-800 rounded-xl p-1 shrink-0">
        {ASPECT_RATIO_OPTIONS.map((opt) => {
          const active = opt.id === aspectRatio;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onChangeAspectRatio(opt.id)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                active
                  ? 'bg-slate-800 text-cyan-300 shadow-sm border border-cyan-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              {getRatioIcon(opt.id)}
              <span>{opt.labelTh}</span>
            </button>
          );
        })}
      </div>

      {/* Mobile / Compact Ratio + Export CTA */}
      <div className="flex items-center gap-2.5 shrink-0">
        <select
          aria-label="เลือกสัดส่วนวิดีโอ"
          value={aspectRatio}
          onChange={(e) => onChangeAspectRatio(e.target.value as AspectRatioId)}
          className="lg:hidden bg-[#0B0D12] border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 outline-none"
        >
          {ASPECT_RATIO_OPTIONS.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.labelTh}
            </option>
          ))}
        </select>

        {capability && !capability.supported && (
          <span
            title={capability.reason}
            className="hidden sm:inline-flex items-center rounded-lg bg-amber-500/15 border border-amber-500/30 px-2.5 py-1 text-[11px] text-amber-300 whitespace-nowrap"
          >
            WebCodecs จำกัด
          </span>
        )}

        <button
          type="button"
          onClick={onOpenExport}
          disabled={!canExport || isExporting}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0 select-none transition-all cursor-pointer ${
            canExport && !isExporting
              ? 'bg-gradient-to-r from-cyan-500 via-blue-500 to-violet-600 text-white shadow-lg shadow-cyan-500/20 hover:brightness-110 active:scale-[0.98]'
              : 'bg-slate-800 text-slate-500 cursor-not-allowed'
          }`}
        >
          <Download className="w-4 h-4" />
          <span>{isExporting ? 'กำลังเรนเดอร์...' : 'ส่งออกวิดีโอ MP4'}</span>
        </button>
      </div>
    </header>
  );
};
