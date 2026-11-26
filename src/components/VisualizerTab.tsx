import React from 'react';
import { RotateCcw } from 'lucide-react';
import { getGradientById } from '../constants/gradients';
import { DEFAULT_VISUALIZER_SETTINGS, POSITION_PRESET_Y } from '../constants/presets';
import { VISUALIZER_STYLES } from '../constants/visualizers';
import { SliderControl, SwitchControl } from './StudioControls';
import { VisualizerThumb } from './VisualizerThumb';
import type { VisualizerPositionPreset, VisualizerSettings } from '../types/studio';

interface VisualizerTabProps {
  settings: VisualizerSettings;
  gradientId: string;
  onChange: (next: VisualizerSettings) => void;
}

export const VisualizerTab: React.FC<VisualizerTabProps> = ({
  settings,
  gradientId,
  onChange,
}) => {
  const palette = getGradientById(gradientId);
  const update = <K extends keyof VisualizerSettings>(key: K, value: VisualizerSettings[K]) => {
    onChange({ ...settings, [key]: value });
  };

  const selectPositionPreset = (preset: VisualizerPositionPreset) => {
    if (preset === 'custom') {
      onChange({ ...settings, positionPreset: 'custom' });
      return;
    }
    onChange({
      ...settings,
      positionPreset: preset,
      positionY: POSITION_PRESET_Y[preset],
    });
  };

  const activeMeta = VISUALIZER_STYLES.find((s) => s.id === settings.styleId);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xs font-bold text-slate-200">
            คลื่นดนตรี 15 แบบ (160 Hz – 16 kHz)
          </h3>
          <p className="text-[11px] text-slate-400 mt-0.5">
            ตัดย่านเบสออกทั้งหมด ตอบสนองเฉพาะทำนอง เสียงร้อง และเครื่องดนตรี
          </p>
        </div>
        <button
          type="button"
          onClick={() => onChange({ ...DEFAULT_VISUALIZER_SETTINGS })}
          title="คืนค่าเริ่มต้น"
          className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-300 hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      <SwitchControl
        label="แสดงคลื่นดนตรี"
        description="โครงสร้างเชิงเส้นและมิติ (ไม่มีทรงวงกลม/Radial)"
        checked={settings.enabled}
        onChange={(checked) => update('enabled', checked)}
      />

      {/* 15 Styles Grid */}
      <div className={`space-y-2.5 ${!settings.enabled ? 'opacity-45 pointer-events-none' : ''}`}>
        <div className="grid grid-cols-2 gap-2">
          {VISUALIZER_STYLES.map((style) => {
            const active = style.id === settings.styleId;
            return (
              <button
                key={style.id}
                type="button"
                onClick={() => update('styleId', style.id)}
                title={`${style.index}. ${style.nameTh} (${style.nameEn})`}
                className={`group rounded-xl p-2 border text-left select-none transition-all cursor-pointer ${
                  active
                    ? 'bg-cyan-500/15 border-cyan-400 shadow-sm shadow-cyan-500/20'
                    : 'bg-[#141926] border-slate-800 hover:border-slate-600'
                }`}
              >
                <VisualizerThumb styleId={style.id} colors={palette.colors} />
                <div className="mt-1.5 px-0.5">
                  <div className="text-[11px] font-semibold text-slate-200 truncate leading-tight">
                    {style.index}. {style.nameTh}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {activeMeta && (
          <div className="rounded-xl bg-[#141926] border border-slate-800/80 px-3 py-2 text-[11px]">
            <div className="font-semibold text-cyan-300">
              {activeMeta.index}. {activeMeta.nameTh}{' '}
              <span className="text-slate-500 font-normal">({activeMeta.nameEn})</span>
            </div>
            <p className="text-slate-400 mt-0.5 leading-snug">{activeMeta.descriptionTh}</p>
          </div>
        )}
      </div>

      {/* Placement & Geometry Controls */}
      <div
        className={`rounded-xl bg-[#141926] border border-slate-800/80 p-3.5 space-y-4 ${
          !settings.enabled ? 'opacity-45 pointer-events-none' : ''
        }`}
      >
        <div className="space-y-1.5">
          <div className="text-xs font-medium text-slate-300">ตำแหน่งวางคลื่น</div>
          <div className="grid grid-cols-4 gap-1.5">
            {(
              [
                ['bottom', 'ล่าง'],
                ['center', 'กลาง'],
                ['top', 'บน'],
                ['custom', 'อิสระ'],
              ] as const
            ).map(([preset, label]) => (
              <button
                key={preset}
                type="button"
                onClick={() => selectPositionPreset(preset)}
                className={`py-1.5 rounded-lg text-[11px] font-medium transition-colors cursor-pointer ${
                  settings.positionPreset === preset
                    ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/40'
                    : 'bg-[#0E121B] text-slate-400 border border-slate-800 hover:text-slate-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <SliderControl
          label="ตำแหน่งแกน Y"
          value={settings.positionY}
          min={8}
          max={92}
          unit="%"
          onChange={(v) =>
            onChange({
              ...settings,
              positionPreset: 'custom',
              positionY: v,
            })
          }
        />

        <SliderControl
          label="ความกว้างคลื่น"
          value={settings.widthPercent}
          min={40}
          max={100}
          unit="%"
          onChange={(v) => update('widthPercent', v)}
        />

        <SliderControl
          label="ความสูงคลื่น"
          value={settings.heightPercent}
          min={10}
          max={80}
          unit="%"
          onChange={(v) => update('heightPercent', v)}
        />

        <SliderControl
          label="ความหนาแท่ง / เส้น"
          value={settings.thickness}
          min={1}
          max={12}
          onChange={(v) => update('thickness', v)}
        />

        <SliderControl
          label="ความโปร่งแสง"
          value={settings.opacity}
          min={15}
          max={100}
          unit="%"
          onChange={(v) => update('opacity', v)}
        />

        <SliderControl
          label="แสงฟุ้ง (Glow Blur)"
          value={settings.glowBlur}
          min={0}
          max={40}
          unit=" px"
          onChange={(v) => update('glowBlur', v)}
        />

        <SliderControl
          label="อัตราขยายคลื่น (Sensitivity)"
          value={settings.sensitivity}
          min={50}
          max={200}
          step={5}
          unit="%"
          onChange={(v) => update('sensitivity', v)}
        />
      </div>
    </div>
  );
};
