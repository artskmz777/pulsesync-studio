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
  dimensions: Record<'1080p' | '720p', { width: number; height: number }>;
}

export const ASPECT_RATIO_OPTIONS: readonly AspectRatioOption[] = [
  {
    id: 'source',
    labelTh: 'ตามไฟล์ที่นำเข้า (อัตโนมัติ)',
    shortLabel: 'ตามไฟล์',
    dimensions: {
      '1080p': { width: 1920, height: 1080 },
      '720p': { width: 1280, height: 720 },
    },
  },
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
    id: '3:2',
    labelTh: 'แนวนอน 3:2 (ภาพถ่าย)',
    shortLabel: '3:2',
    dimensions: {
      '1080p': { width: 1620, height: 1080 },
      '720p': { width: 1080, height: 720 },
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
  {
    id: '4:5',
    labelTh: 'แนวตั้ง 4:5 (IG/FB)',
    shortLabel: '4:5',
    dimensions: {
      '1080p': { width: 1080, height: 1350 },
      '720p': { width: 720, height: 900 },
    },
  },
  {
    id: '2:3',
    labelTh: 'แนวตั้ง 2:3 (โปสเตอร์)',
    shortLabel: '2:3',
    dimensions: {
      '1080p': { width: 1080, height: 1620 },
      '720p': { width: 720, height: 1080 },
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
];

export function getAspectRatioOption(aspectRatio: AspectRatioId): AspectRatioOption {
  return ASPECT_RATIO_OPTIONS.find((item) => item.id === aspectRatio) ?? ASPECT_RATIO_OPTIONS[0];
}

function roundToEven(val: number): number {
  return Math.max(2, Math.round(val / 2) * 2);
}

export function formatSimplifiedRatio(width: number, height: number): string {
  if (width <= 0 || height <= 0) return '—';
  let a = Math.round(width);
  let b = Math.round(height);
  while (b !== 0) {
    const t = a % b;
    a = b;
    b = t;
  }
  const rw = Math.round(width / Math.max(1, a));
  const rh = Math.round(height / Math.max(1, a));
  if (rw > 32 || rh > 32) {
    return `${(width / height).toFixed(2)}:1`;
  }
  return `${rw}:${rh}`;
}

export function getOutputDimensions(
  aspectRatio: AspectRatioId,
  resolution: ResolutionTier,
  sourceSize?: { width: number; height: number } | null,
): { width: number; height: number } {
  if (aspectRatio === 'source' && sourceSize && sourceSize.width > 0 && sourceSize.height > 0) {
    const srcW = sourceSize.width;
    const srcH = sourceSize.height;
    const shortSide = Math.min(srcW, srcH);
    const longSide = Math.max(srcW, srcH);

    let scale = 1;
    if (resolution === 'native') {
      // Keep native dimensions up to 1920px long edge for reliable WebCodecs H.264 encoding
      scale = longSide > 1920 ? 1920 / longSide : 1;
    } else if (resolution === '1080p') {
      scale = Math.min(1080 / shortSide, 1920 / longSide);
    } else {
      scale = Math.min(720 / shortSide, 1280 / longSide);
    }

    return {
      width: roundToEven(srcW * scale),
      height: roundToEven(srcH * scale),
    };
  }

  const presetTier: '1080p' | '720p' = resolution === '720p' ? '720p' : '1080p';
  const fallbackId: AspectRatioId = aspectRatio === 'source' ? '16:9' : aspectRatio;
  const option = ASPECT_RATIO_OPTIONS.find((item) => item.id === fallbackId) ?? ASPECT_RATIO_OPTIONS[1]!;
  return option.dimensions[presetTier];
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
