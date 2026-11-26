import type {
  BassSettings,
  ComputedAnalysis,
  FrameAnalysis,
  RawSpectrumData,
} from '../types/studio';

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/**
 * Computes deterministic dual-band frame envelopes from cached FFT spectrum data.
 * Runs in < 5ms for a full song whenever BassSettings sliders change, keeping
 * live preview and offline MP4 export 100% frame-identical.
 */
export function computeFrameAnalysis(
  raw: RawSpectrumData,
  bassSettings: BassSettings,
): ComputedAnalysis {
  const { totalFrames, fps, bassSubBandHz, bassSubEnergies, bassSubBandCount } = raw;
  const dt = 1 / fps;

  // Determine active sub-bands within [20 Hz .. bassSettings.cutoffHz]
  let activeSubBands = 0;
  for (let b = 0; b < bassSubBandCount; b++) {
    if (bassSubBandHz[b]! <= bassSettings.cutoffHz + 2) {
      activeSubBands = b + 1;
    }
  }
  activeSubBands = Math.max(1, activeSubBands);

  const rawEnergy = new Float32Array(totalFrames);
  const nonZeroEnergies: number[] = [];

  for (let i = 0; i < totalFrames; i++) {
    const base = i * bassSubBandCount;
    let weightedSum = 0;
    let weightTotal = 0;
    for (let b = 0; b < activeSubBands; b++) {
      // Slight weighting favoring 45 - 110 Hz kick punch over ultra-low DC rumble
      const hz = bassSubBandHz[b]!;
      const kickWeight = hz >= 40 && hz <= 115 ? 1.25 : 0.85;
      weightedSum += bassSubEnergies[base + b]! * kickWeight;
      weightTotal += kickWeight;
    }
    const e = weightTotal > 0 ? weightedSum / weightTotal : 0;
    rawEnergy[i] = e;
    if (e > 1e-5) {
      nonZeroEnergies.push(e);
    }
  }

  // Reference 95th percentile energy prevents quiet songs from flatlining or loud tracks from clipping
  let refEnergy = 0.05;
  if (nonZeroEnergies.length > 0) {
    nonZeroEnergies.sort((a, b) => a - b);
    const idx95 = Math.min(nonZeroEnergies.length - 1, Math.floor(nonZeroEnergies.length * 0.95));
    refEnergy = Math.max(nonZeroEnergies[idx95]!, 0.008);
  }

  // Rolling energy average (~360 ms time constant) to separate kick onset from sub-bass drone
  const avgAlpha = 1 - Math.exp(-dt / 0.36);
  const thresholdNorm = bassSettings.threshold / 100;
  const smoothNorm = bassSettings.smoothness / 100;

  // Spec: Attack 10 - 25 ms, Release 140 - 280 ms
  const attackMs = 10 + smoothNorm * 15;
  const releaseMs = 140 + smoothNorm * 140;
  const attackAlpha = 1 - Math.exp(-dt / (attackMs / 1000));
  const releaseAlpha = 1 - Math.exp(-dt / (releaseMs / 1000));

  let rollingAvg = rawEnergy[0] ?? 0;
  let env = 0;
  let peakBassFrames = 0;
  const onsetTimes: number[] = [];
  let lastOnsetTime = -1;

  const frames: FrameAnalysis[] = new Array(totalFrames);

  for (let i = 0; i < totalFrames; i++) {
    const e = rawEnergy[i]!;
    rollingAvg += (e - rollingAvg) * avgAlpha;

    const normLevel = e / refEnergy;
    const normAvg = rollingAvg / refEnergy;

    // Onset transient above moving average
    const onsetRatio = 0.72 + thresholdNorm * 0.78;
    const transient = Math.max(0, normLevel - normAvg * onsetRatio);

    // Sustained punch above absolute noise gate
    const gateFloor = 0.08 + thresholdNorm * 0.45;
    const sustained = Math.max(0, normLevel - gateFloor);

    // Blend onset detection (70%) + strong sub sustain (30%) for crisp, musical kick response
    const target = bassSettings.enabled
      ? clamp01(transient * 1.45 + sustained * 0.38)
      : 0;

    if (target > env) {
      env += (target - env) * attackAlpha;
    } else {
      env += (target - env) * releaseAlpha;
    }

    const bassImpact = clamp01(transient * 1.6);
    if (bassImpact > 0.35) {
      peakBassFrames++;
      const t = i / fps;
      if (t - lastOnsetTime > 0.24) {
        onsetTimes.push(t);
        lastOnsetTime = t;
      }
    }

    // Deterministic sine-damped micro shake modulated by smooth envelope (zero random jitter)
    const phase = i * dt * 28;
    const shakeAmp = env * (0.45 + bassImpact * 0.55);
    const shakeX = Math.sin(phase) * shakeAmp;
    const shakeY = Math.cos(phase * 1.31 + 0.7) * shakeAmp;

    frames[i] = {
      bass: clamp01(env),
      bassImpact,
      shakeX,
      shakeY,
    };
  }

  const estimatedBpm = estimateBpmFromOnsets(onsetTimes);

  // Build 240-bucket timeline waveform for UI scrubber
  const timelineBuckets = Math.min(240, Math.max(1, totalFrames));
  const timelineBass = new Float32Array(timelineBuckets);
  for (let b = 0; b < timelineBuckets; b++) {
    const startIdx = Math.floor((b * totalFrames) / timelineBuckets);
    const endIdx = Math.max(startIdx + 1, Math.floor(((b + 1) * totalFrames) / timelineBuckets));
    let peak = 0;
    for (let i = startIdx; i < endIdx && i < totalFrames; i++) {
      if (frames[i]!.bass > peak) peak = frames[i]!.bass;
    }
    timelineBass[b] = peak;
  }

  return {
    raw,
    frames,
    timelineBass,
    estimatedBpm,
    peakBassFrames,
  };
}

function estimateBpmFromOnsets(onsets: number[]): number {
  if (onsets.length < 4) return 0;
  const bpmHistogram = new Map<number, number>();
  for (let i = 1; i < onsets.length; i++) {
    const delta = onsets[i]! - onsets[i - 1]!;
    if (delta < 0.28 || delta > 1.2) continue;
    let bpm = Math.round(60 / delta);
    while (bpm < 70) bpm *= 2;
    while (bpm > 175) bpm = Math.round(bpm / 2);
    bpmHistogram.set(bpm, (bpmHistogram.get(bpm) ?? 0) + 1);
    // Count neighbors (+/- 1 BPM) to smooth frame quantization
    bpmHistogram.set(bpm - 1, (bpmHistogram.get(bpm - 1) ?? 0) + 0.5);
    bpmHistogram.set(bpm + 1, (bpmHistogram.get(bpm + 1) ?? 0) + 0.5);
  }
  let bestBpm = 0;
  let bestScore = 0;
  for (const [bpm, score] of bpmHistogram.entries()) {
    if (score > bestScore) {
      bestScore = score;
      bestBpm = bpm;
    }
  }
  return bestBpm;
}
