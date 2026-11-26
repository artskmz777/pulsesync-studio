import React from 'react';
import { AudioLines, Download, Palette, Sliders } from 'lucide-react';
import { BassTab } from './BassTab';
import { ExportTab } from './ExportTab';
import { GradientTab } from './GradientTab';
import { VisualizerTab } from './VisualizerTab';
import type {
  AspectRatioId,
  BassSettings,
  ExportSettings,
  GradientSettings,
  InspectorTabId,
  VisualizerSettings,
  WebCodecsCapability,
} from '../types/studio';

interface InspectorPanelProps {
  activeTab: InspectorTabId;
  onChangeTab: (tab: InspectorTabId) => void;
  aspectRatio: AspectRatioId;
  bass: BassSettings;
  onChangeBass: (next: BassSettings) => void;
  visualizer: VisualizerSettings;
  onChangeVisualizer: (next: VisualizerSettings) => void;
  gradient: GradientSettings;
  onChangeGradient: (next: GradientSettings) => void;
  exportSettings: ExportSettings;
  onChangeExport: (next: ExportSettings) => void;
  duration: number;
  canExport: boolean;
  isExporting: boolean;
  capability: WebCodecsCapability | null;
  onStartExport: () => void;
}

const TABS: readonly { id: InspectorTabId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'bass', label: 'เบส', icon: Sliders },
  { id: 'visualizer', label: 'คลื่นดนตรี', icon: AudioLines },
  { id: 'gradient', label: 'ชุดสี', icon: Palette },
  { id: 'export', label: 'ส่งออก', icon: Download },
];

export const InspectorPanel: React.FC<InspectorPanelProps> = ({
  activeTab,
  onChangeTab,
  aspectRatio,
  bass,
  onChangeBass,
  visualizer,
  onChangeVisualizer,
  gradient,
  onChangeGradient,
  exportSettings,
  onChangeExport,
  duration,
  canExport,
  isExporting,
  capability,
  onStartExport,
}) => {
  return (
    <aside className="w-full lg:w-[292px] xl:w-[332px] 2xl:w-[365px] shrink-0 bg-[#10141F] border-l border-slate-800/90 flex flex-col overflow-hidden">
      {/* 4 Tab Switcher */}
      <nav
        aria-label="แผงปรับแต่งสตูดิโอ"
        className="grid grid-cols-4 gap-1 p-2 border-b border-slate-800/90 bg-[#0D1019] shrink-0"
      >
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChangeTab(tab.id)}
              className={`flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-xl text-[11px] font-semibold transition-all cursor-pointer ${
                active
                  ? 'bg-[#182033] text-cyan-300 border border-cyan-500/35 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border border-transparent'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Tab Body */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'bass' && <BassTab settings={bass} onChange={onChangeBass} />}
        {activeTab === 'visualizer' && (
          <VisualizerTab
            settings={visualizer}
            gradientId={gradient.gradientId}
            onChange={onChangeVisualizer}
          />
        )}
        {activeTab === 'gradient' && (
          <GradientTab settings={gradient} onChange={onChangeGradient} />
        )}
        {activeTab === 'export' && (
          <ExportTab
            aspectRatio={aspectRatio}
            settings={exportSettings}
            duration={duration}
            canExport={canExport}
            isExporting={isExporting}
            capability={capability}
            onChange={onChangeExport}
            onStartExport={onStartExport}
          />
        )}
      </div>
    </aside>
  );
};
