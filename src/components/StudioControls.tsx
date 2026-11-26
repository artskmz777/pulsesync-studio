import React from 'react';

interface SliderControlProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  hint?: string;
  disabled?: boolean;
  onChange: (value: number) => void;
}

export const SliderControl: React.FC<SliderControlProps> = ({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '',
  hint,
  disabled = false,
  onChange,
}) => {
  return (
    <div className={`space-y-1.5 ${disabled ? 'opacity-45 pointer-events-none' : ''}`}>
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-300 font-medium">{label}</span>
        <span className="font-mono text-cyan-300 tabular-nums">
          {value}
          {unit}
        </span>
      </div>
      <input
        type="range"
        className="studio-slider w-full"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      {hint && <p className="text-[11px] text-slate-500 leading-tight">{hint}</p>}
    </div>
  );
};

interface SwitchControlProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export const SwitchControl: React.FC<SwitchControlProps> = ({
  label,
  description,
  checked,
  onChange,
}) => {
  return (
    <label className="flex items-center justify-between gap-3 rounded-xl bg-[#161B28] border border-slate-800/80 px-3.5 py-2.5 cursor-pointer hover:border-slate-700/80 transition-colors">
      <div className="min-w-0">
        <div className="text-xs font-semibold text-slate-200">{label}</div>
        {description && <div className="text-[11px] text-slate-400 mt-0.5">{description}</div>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
          checked ? 'bg-cyan-500' : 'bg-slate-700'
        }`}
      >
        <span
          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-4.5' : 'translate-x-1'
          }`}
        />
      </button>
    </label>
  );
};
