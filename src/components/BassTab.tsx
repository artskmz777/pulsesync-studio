import React from 'react';
import { RotateCcw } from 'lucide-react';
import { DEFAULT_BASS_SETTINGS } from '../constants/presets';
import { SliderControl, SwitchControl } from './StudioControls';
import type { BassSettings } from '../types/studio';

interface BassTabProps {
  settings: BassSettings;
  onChange: (next: BassSettings) => void;
}

export const BassTab: React.FC<BassTabProps> = ({ settings, onChange }) => {
  const update = <K extends keyof BassSettings>(key: K, value: BassSettings[K]) => {
    onChange({ ...settings, [key]: value });
  };

  const smoothNorm = settings.smoothness / 100;
  const attackMs = Math.round(10 + smoothNorm * 15);
  const releaseMs = Math.round(140 + smoothNorm * 140);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xs font-bold text-slate-200">ระบบตอบสนองเบส (20–{settings.cutoffHz} Hz)</h3>
          <p className="text-[11px] text-slate-400 mt-0.5">
            คุมการซูม/สั่น/แสงวาบของภาพหรือวิดีโอตามหัวจังหวะกลอง
          </p>
        </div>
        <button
          type="button"
          onClick={() => onChange({ ...DEFAULT_BASS_SETTINGS })}
          title="คืนค่าเริ่มต้น"
          className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-300 hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      <SwitchControl
        label="เปิดใช้งานเอฟเฟกต์เบส"
        description="ซิงก์ภาพพื้นหลังกับกลอง Kick และ Sub-Bass"
        checked={settings.enabled}
        onChange={(checked) => update('enabled', checked)}
      />

      <div className="rounded-xl bg-[#141926] border border-slate-800/80 p-3.5 space-y-4">
        <SliderControl
          label="จุดตัดความถี่เบส (Cutoff)"
          value={settings.cutoffHz}
          min={60}
          max={160}
          step={5}
          unit=" Hz"
          hint="วิเคราะห์เฉพาะย่าน 20 Hz ถึงค่าที่เลือก (แนะนำ 140 Hz)"
          disabled={!settings.enabled}
          onChange={(v) => update('cutoffHz', v)}
        />

        <SliderControl
          label="ความแรงเบส (Bass Intensity)"
          value={settings.intensity}
          min={0}
          max={100}
          unit="%"
          hint={`ซูมสูงสุด ${(1 + (settings.intensity / 100) * 0.12).toFixed(2)}x ตามแรงปะทะ`}
          disabled={!settings.enabled}
          onChange={(v) => update('intensity', v)}
        />

        <SliderControl
          label="ความนุ่มนวล (Smoothness)"
          value={settings.smoothness}
          min={0}
          max={100}
          unit="%"
          hint={`Attack ${attackMs} ms • Release Decay ${releaseMs} ms`}
          disabled={!settings.enabled}
          onChange={(v) => update('smoothness', v)}
        />

        <SliderControl
          label="ความไวจับจังหวะ (Threshold)"
          value={settings.threshold}
          min={0}
          max={100}
          unit="%"
          hint="ยิ่งสูง ยิ่งกรองเบสเบาๆ ออก ให้กระตุกเฉพาะจังหวะหนัก"
          disabled={!settings.enabled}
          onChange={(v) => update('threshold', v)}
        />

        <SliderControl
          label="แรงสั่นนุ่ม (Micro Shake)"
          value={settings.microShake}
          min={0}
          max={100}
          unit="%"
          hint="ขยับแกน X/Y แบบ Sine-damped อย่างนุ่มนวลไร้การสั่นกระชาก"
          disabled={!settings.enabled}
          onChange={(v) => update('microShake', v)}
        />

        <SliderControl
          label="แสงวาบตามเบส (Bass Glow)"
          value={settings.bassGlow}
          min={0}
          max={100}
          unit="%"
          hint="เพิ่มความสว่างและแสงสีตามโทนชุดสีในช่วงพีคของเบส"
          disabled={!settings.enabled}
          onChange={(v) => update('bassGlow', v)}
        />
      </div>
    </div>
  );
};
