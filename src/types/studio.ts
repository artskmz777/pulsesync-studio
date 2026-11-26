export type AspectRatioId = 'source' | '16:9' | '3:2' | '1:1' | '4:5' | '2:3' | '9:16';
export type ResolutionTier = 'native' | '1080p' | '720p';
export type FrameRateOption = 30 | 60;
export type BitrateQuality = 'high' | 'standard';

export type BackgroundMediaType = 'none' | 'image' | 'video';
export type ImageFitMode = 'cover' | 'contain';
export type AudioSourceMode = 'video' | 'custom';

export type VisualizerStyleId =
  | 'classic-bars'
  | 'mirrored-bars'
  | 'bezier-wave'
  | 'silk-ribbons'
  | 'mountain-fill'
  | 'oscilloscope'
  | 'led-matrix'
  | 'floating-pills'
  | 'dual-horizon'
  | 'dot-matrix'
  | 'slanted-bars'
  | 'stereo-strips'
  | 'particle-stream'
  | 'perspective-terrain'
  | 'hairline-spectrum';

export type VisualizerPositionPreset = 'bottom' | 'center' | 'top' | 'custom';
export type GradientDirection = 'horizontal' | 'vertical' | 'diagonal';
export type InspectorTabId = 'bass' | 'visualizer' | 'gradient' | 'export';

export interface TriColorGradient {
  id: string;
  nameTh: string;
  nameEn: string;
  colors: readonly [string, string, string];
}

export interface VisualizerStyleMeta {
  id: VisualizerStyleId;
  index: number;
  nameTh: string;
  nameEn: string;
  descriptionTh: string;
}

export interface BassSettings {
  enabled: boolean;
  cutoffHz: number; // 60 - 160 Hz (low bound fixed at 20 Hz)
  intensity: number; // 0 - 100%
  smoothness: number; // 0 - 100% (maps to release decay 140 - 280 ms)
  threshold: number; // 0 - 100% (onset filter sensitivity)
  microShake: number; // 0 - 100%
  bassGlow: number; // 0 - 100%
}

export interface VisualizerSettings {
  enabled: boolean;
  styleId: VisualizerStyleId;
  positionPreset: VisualizerPositionPreset;
  positionY: number; // 0 - 100% of frame height (center of visualizer band)
  widthPercent: number; // 40 - 100%
  heightPercent: number; // 10 - 90%
  thickness: number; // 1 - 12 (bar gap/width ratio or stroke width)
  opacity: number; // 10 - 100%
  glowBlur: number; // 0 - 40 px
  sensitivity: number; // 50 - 200%
}

export interface GradientSettings {
  gradientId: string;
  direction: GradientDirection;
}

export interface ExportSettings {
  resolution: ResolutionTier;
  fps: FrameRateOption;
  bitrateQuality: BitrateQuality;
}

export interface MediaSourceState {
  backgroundType: BackgroundMediaType;
  backgroundFile: File | null;
  backgroundFileName: string;
  backgroundUrl: string | null;
  backgroundWidth: number;
  backgroundHeight: number;
  backgroundDuration: number;
  imageFit: ImageFitMode;
  bleedPercent: number; // 10 - 18% safety bleed for bass zoom & shake
  loopVideo: boolean;
  videoHasAudio: boolean;
  audioSourceMode: AudioSourceMode;
  customAudioFile: File | null;
  customAudioFileName: string;
}

export interface RawSpectrumData {
  fps: FrameRateOption;
  duration: number;
  totalFrames: number;
  sampleRate: number;
  bassSubBandHz: readonly number[]; // center frequencies from 20..160 Hz (12 sub-bands)
  bassSubEnergies: Float32Array; // length = totalFrames * bassSubBandCount
  bassSubBandCount: number;
  melodicBins: Float32Array; // length = totalFrames * melodicBinCount (strictly 160..16000 Hz)
  melodicBinCount: number; // 64
  oscilloscopeSlices: Float32Array; // length = totalFrames * oscSampleCount (160 Hz high-passed)
  oscSampleCount: number; // 96
}

export interface FrameAnalysis {
  bass: number; // 0..1 asymmetric smoothed envelope
  bassImpact: number; // 0..1 onset spike
  shakeX: number; // -1..1 deterministic damped X offset
  shakeY: number; // -1..1 deterministic damped Y offset
}

export interface AnalysisSummary {
  status: 'idle' | 'decoding' | 'analyzing' | 'ready' | 'error';
  progress: number; // 0..100
  statusLabel: string;
  errorMessage?: string;
  duration: number;
  sampleRate: number;
  totalFrames: number;
  estimatedBpm: number;
  peakBassFrames: number;
}

export interface ComputedAnalysis {
  raw: RawSpectrumData;
  frames: FrameAnalysis[];
  timelineBass: Float32Array; // compact downsampled envelope for scrubber waveform
  estimatedBpm: number;
  peakBassFrames: number;
}

export interface ExportProgressState {
  isOpen: boolean;
  status: 'idle' | 'preparing' | 'rendering' | 'muxing' | 'completed' | 'cancelled' | 'error';
  progress: number; // 0..100
  currentFrame: number;
  totalFrames: number;
  elapsedSeconds: number;
  etaSeconds: number;
  message: string;
  errorMessage?: string;
  outputBlobUrl?: string;
  outputFileName?: string;
  outputSizeBytes?: number;
}

export interface WebCodecsCapability {
  supported: boolean;
  videoEncoder: boolean;
  audioEncoder: boolean;
  videoDecoder: boolean;
  h264Supported: boolean;
  aacSupported: boolean;
  opusSupported: boolean;
  reason?: string;
}
