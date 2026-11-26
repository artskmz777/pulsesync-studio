import type {
  AspectRatioId,
  BassSettings,
  ExportSettings,
  GradientSettings,
  ResolutionTier,
  VisualizerPositionPreset,
  VisualizerSettings,
} from '../types/studio';

export interface AspectRatioOption {
  id: AspectRatioId;
  labelTh: string;
  shortLabel: string;
  dimensions: Record<ResolutionTier, { width: number; height: number }>;
}

export const ASPECT_RATIO_OPTIONS: readonly AspectRatioOption[] = [
  {
    id: '16:9',
    labelTh: 'แนวนอน 16:9 (YouTube)',
    shortLabel: '16:9',
    dimensions: {
      '1080p': { width: 1920, height: 1080 },
      '720p': { width: 1280, height: 720 },
    },
  },
  {
    id: '9:16',
    labelTh: 'แนวตั้ง 9:16 (TikTok/Reels)',
    shortLabel: '9:16',
    dimensions: {
      '1080p': { width: 1080, height: 1920 },
      '720p': { width: 720, height: 1280 },
    },
  },
  {
    id: '1:1',
    labelTh: 'จัตุรัส 1:1',
    shortLabel: '1:1',
    dimensions: {
      '1080p': { width: 1080, height: 1080 },
      '720p': { width: 720, height: 720 },
    },
  },
];

export function getOutputDimensions(
  aspectRatio: AspectRatioId,
  resolution: ResolutionTier,
): { width: number; height: number } {
  const option = ASPECT_RATIO_OPTIONS.find((item) => item.id === aspectRatio) ?? ASPECT_RATIO_OPTIONS[0];
  return option.dimensions[resolution];
}

export const POSITION_PRESET_Y: Record<Exclude<VisualizerPositionPreset, 'custom'>, number> = {
  top: 22,
  center: 50,
  bottom: 78,
};

export const DEFAULT_BASS_SETTINGS: BassSettings = {
  enabled: true,
  cutoffHz: 140,
  intensity: 68,
  smoothness: 60,
  threshold: 28,
  microShake: 32,
  bassGlow: 42,
};

export const DEFAULT_VISUALIZER_SETTINGS: VisualizerSettings = {
  enabled: true,
  styleId: 'classic-bars',
  positionPreset: 'bottom',
  positionY: 78,
  widthPercent: 84,
  heightPercent: 28,
  thickness: 5,
  opacity: 92,
  glowBlur: 14,
  sensitivity: 105,
};

export const DEFAULT_GRADIENT_SETTINGS: GradientSettings = {
  gradientId: 'cyber-neon',
  direction: 'horizontal',
};

export const DEFAULT_EXPORT_SETTINGS: ExportSettings = {
  resolution: '1080p',
  fps: 60,
  bitrateQuality: 'high',
};
