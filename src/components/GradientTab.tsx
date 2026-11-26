import React from 'react';
import { TRI_COLOR_GRADIENTS } from '../constants/gradients';
import type { GradientDirection, GradientSettings } from '../types/studio';

interface GradientTabProps {
  settings: GradientSettings;
  onChange: (next: GradientSettings) => void;
}

export const GradientTab: React.FC<GradientTabProps> = ({ settings, onChange }) => {
  const getCssAngle = (dir: GradientDirection) => {
    switch (dir) {
      case 'vertical':
        return '0deg';
      case 'diagonal':
        return '45deg';
      default:
        return '90deg';
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-xs font-bold text-slate-200">ชุดสีไล่เฉด 3 สี (20 ชุด)</h3>
        <p className="text-[11px] text-slate-400 mt-0.5">
          ไล่เฉด 0% → 50% → 100% พร้อมปรับทิศทางบนคลื่นดนตรีและแสงวาบเบส
        </p>
      </div>

      {/* Direction selector */}
      <div className="rounded-xl bg-[#141926] border border-slate-800/80 p-3 space-y-2">
        <div className="text-xs font-medium text-slate-300">ทิศทางการไล่เฉดสี</div>
        <div className="grid grid-cols-3 gap-1.5">
          {(
            [
              ['horizontal', 'แนวนอน'],
              ['vertical', 'แนวตั้ง'],
              ['diagonal', 'เฉียง'],
            ] as const
          ).map(([dir, label]) => (
            <button
              key={dir}
              type="button"
              onClick={() => onChange({ ...settings, direction: dir })}
              className={`py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                settings.direction === dir
                  ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/40'
                  : 'bg-[#0E121B] text-slate-400 border border-slate-800 hover:text-slate-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 20 Gradient Cards */}
      <div className="space-y-2">
        {TRI_COLOR_GRADIENTS.map((grad, idx) => {
          const active = grad.id === settings.gradientId;
          return (
            <button
              key={grad.id}
              type="button"
              onClick={() => onChange({ ...settings, gradientId: grad.id })}
              className={`w-full rounded-xl border p-2.5 text-left transition-all cursor-pointer ${
                active
                  ? 'bg-cyan-500/12 border-cyan-400 shadow-sm shadow-cyan-500/15'
                  : 'bg-[#141926] border-slate-800/80 hover:border-slate-600'
              }`}
            >
              <div
                className="h-3.5 w-full rounded-md shadow-inner"
                style={{
                  background: `linear-gradient(${getCssAngle(settings.direction)}, ${grad.colors[0]} 0%, ${grad.colors[1]} 50%, ${grad.colors[2]} 100%)`,
                }}
              />
              <div className="flex flex-col gap-1.5 mt-2">
                <div className="flex items-baseline justify-between gap-2">
                  <div className="text-xs font-semibold text-slate-100">
                    {idx + 1}. {grad.nameTh}
                  </div>
                  <div className="text-[10px] text-slate-500 shrink-0">{grad.nameEn}</div>
                </div>
                <div className="flex items-center gap-1.5 font-mono text-[10px] text-slate-400">
                  {grad.colors.map((hex) => (
                    <span
                      key={hex}
                      className="inline-flex items-center gap-1 rounded bg-[#0B0E16] border border-slate-800 px-1.5 py-0.5"
                    >
                      <span
                        className="w-2 h-2 rounded-xs"
                        style={{ backgroundColor: hex }}
                      />
                      {hex}
                    </span>
                  ))}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
