import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyButterworthHighPass,
  BASS_SUB_BAND_HZ,
  buildMelodicBandMap,
  computeFrameSpectrum,
  createFftWorkspace,
  FFT_SIZE,
  MELODIC_BIN_COUNT,
  OSC_SAMPLE_COUNT,
} from '../src/dsp/fft.ts';
import { computeFrameAnalysis } from '../src/dsp/envelope.ts';
import { TRI_COLOR_GRADIENTS } from '../src/constants/gradients.ts';
import { VISUALIZER_STYLES } from '../src/constants/visualizers.ts';
import {
  ASPECT_RATIO_OPTIONS,
  DEFAULT_BASS_SETTINGS,
  formatSimplifiedRatio,
  getOutputDimensions,
} from '../src/constants/presets.ts';
import type { RawSpectrumData } from '../src/types/studio.ts';

function synthSine(freqHz: number, sampleRate: number, durationSec: number, amp = 0.8): Float32Array {
  const len = Math.round(sampleRate * durationSec);
  const out = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    out[i] = Math.sin((2 * Math.PI * freqHz * i) / sampleRate) * amp;
  }
  return out;
}

test('Strict Bass Exclusion: 60 Hz tone triggers bass band and yields zero melodic energy >= 160 Hz', () => {
  const sr = 48000;
  const pcm = synthSine(60, sr, 0.5, 0.9);
  const ws = createFftWorkspace(FFT_SIZE);
  const mag = computeFrameSpectrum(pcm, Math.floor(pcm.length / 2), ws);
  const melodicMap = buildMelodicBandMap(sr, FFT_SIZE, MELODIC_BIN_COUNT);

  const binHz = sr / FFT_SIZE;
  for (const band of melodicMap) {
    assert.ok(band.startBin * binHz >= 160 - 1e-6, `Band leaked below 160 Hz: ${band.startBin * binHz}`);
  }

  let maxMelodic = 0;
  for (const band of melodicMap) {
    for (let b = band.startBin; b <= band.endBin; b++) {
      if (mag[b]! > maxMelodic) maxMelodic = mag[b]!;
    }
  }
  const bassBin = Math.round(60 / binHz);
  const bassAmp = mag[bassBin]!;
  assert.ok(bassAmp > 0.6, `Expected strong 60 Hz peak, got ${bassAmp}`);
  assert.ok(maxMelodic < 0.002, `Expected near-zero melodic leakage for 60 Hz, got ${maxMelodic}`);
});

test('Melodic Mapping: 1200 Hz tone activates mid-high band with near-zero sub-bass energy', () => {
  const sr = 48000;
  const pcm = synthSine(1200, sr, 0.5, 0.8);
  const ws = createFftWorkspace(FFT_SIZE);
  const mag = computeFrameSpectrum(pcm, Math.floor(pcm.length / 2), ws);
  const melodicMap = buildMelodicBandMap(sr, FFT_SIZE, MELODIC_BIN_COUNT);

  const binHz = sr / FFT_SIZE;
  let subBassMax = 0;
  const maxBassBin = Math.floor(140 / binHz);
  for (let b = 1; b <= maxBassBin; b++) {
    if (mag[b]! > subBassMax) subBassMax = mag[b]!;
  }

  let peakBandIdx = -1;
  let peakVal = 0;
  melodicMap.forEach((band, idx) => {
    for (let b = band.startBin; b <= band.endBin; b++) {
      if (mag[b]! > peakVal) {
        peakVal = mag[b]!;
        peakBandIdx = idx;
      }
    }
  });

  assert.ok(subBassMax < 0.002, `Expected no sub-bass energy, got ${subBassMax}`);
  assert.ok(peakVal > 0.6 && peakBandIdx > 15 && peakBandIdx < 45, `Unexpected peak band ${peakBandIdx}`);
});

test('Butterworth 160 Hz High-Pass attenuates 50 Hz heavily while preserving 1000 Hz', () => {
  const sr = 48000;
  const low = applyButterworthHighPass(synthSine(50, sr, 0.4, 1.0), sr, 160);
  const high = applyButterworthHighPass(synthSine(1000, sr, 0.4, 1.0), sr, 160);

  const tailStart = Math.floor(sr * 0.15);
  let lowRms = 0;
  let highRms = 0;
  for (let i = tailStart; i < low.length; i++) {
    lowRms += low[i]! * low[i]!;
    highRms += high[i]! * high[i]!;
  }
  lowRms = Math.sqrt(lowRms / (low.length - tailStart));
  highRms = Math.sqrt(highRms / (high.length - tailStart));

  assert.ok(lowRms < 0.02, `50 Hz should be heavily attenuated, got RMS=${lowRms}`);
  assert.ok(highRms > 0.65, `1000 Hz should pass cleanly, got RMS=${highRms}`);
});

test('Asymmetric Envelope Follower reacts fast on beat and decays smoothly over 140-280 ms', () => {
  const fps = 60;
  const totalFrames = 120;
  const subCount = BASS_SUB_BAND_HZ.length;
  const bassSubEnergies = new Float32Array(totalFrames * subCount);

  // Inject a sharp kick pulse on frame 15..16 (at 55 Hz sub-band)
  for (let b = 0; b < 5; b++) {
    bassSubEnergies[15 * subCount + b] = 1.0;
    bassSubEnergies[16 * subCount + b] = 0.9;
  }

  const raw: RawSpectrumData = {
    fps,
    duration: 2,
    totalFrames,
    sampleRate: 48000,
    bassSubBandHz: [...BASS_SUB_BAND_HZ],
    bassSubEnergies,
    bassSubBandCount: subCount,
    melodicBins: new Float32Array(totalFrames * MELODIC_BIN_COUNT),
    melodicBinCount: MELODIC_BIN_COUNT,
    oscilloscopeSlices: new Float32Array(totalFrames * OSC_SAMPLE_COUNT),
    oscSampleCount: OSC_SAMPLE_COUNT,
  };

  const analysis = computeFrameAnalysis(raw, DEFAULT_BASS_SETTINGS);
  const peakAtKick = analysis.frames[16]!.bass;
  const decayAt5Frames = analysis.frames[21]!.bass;
  const decayAt15Frames = analysis.frames[31]!.bass;

  assert.ok(peakAtKick > 0.5, `Expected strong attack on kick frame, got ${peakAtKick}`);
  assert.ok(decayAt5Frames > 0.15 && decayAt5Frames < peakAtKick, 'Expected smooth decay at +83ms');
  assert.ok(decayAt15Frames < decayAt5Frames, 'Expected continued exponential decay at +250ms');
});

test('Catalog completeness: exactly 15 non-circular visualizers and 20 tri-color gradients', () => {
  assert.equal(VISUALIZER_STYLES.length, 15);
  assert.equal(TRI_COLOR_GRADIENTS.length, 20);
  for (const style of VISUALIZER_STYLES) {
    assert.doesNotMatch(style.nameEn.toLowerCase(), /circle|circular|radial|ring|polar/);
  }
  for (const g of TRI_COLOR_GRADIENTS) {
    assert.equal(g.colors.length, 3);
    for (const hex of g.colors) {
      assert.match(hex, /^#[0-9A-F]{6}$/);
    }
  }
});

test('Aspect ratios include source, 16:9, 3:2, 1:1, 4:5, 2:3, 9:16 with valid even export dimensions', () => {
  const expectedIds = ['source', '16:9', '3:2', '1:1', '4:5', '2:3', '9:16'];
  assert.deepEqual(
    ASPECT_RATIO_OPTIONS.map((o) => o.id),
    expectedIds,
  );
  for (const opt of ASPECT_RATIO_OPTIONS) {
    if (opt.id === 'source') continue;
    const [rw, rh] = opt.id.split(':').map(Number);
    for (const tier of ['1080p', '720p'] as const) {
      const { width, height } = getOutputDimensions(opt.id, tier);
      assert.equal(width % 2, 0, `${opt.id} ${tier} width must be even`);
      assert.equal(height % 2, 0, `${opt.id} ${tier} height must be even`);
      assert.ok(
        Math.abs(width / height - rw! / rh!) < 1e-6,
        `${opt.id} ${tier} ratio mismatch: ${width}x${height}`,
      );
    }
  }

  // Verify dynamic 'source' aspect ratio matching across custom image/video sizes
  assert.deepEqual(getOutputDimensions('source', 'native', { width: 720, height: 720 }), {
    width: 720,
    height: 720,
  });
  assert.deepEqual(getOutputDimensions('source', '1080p', { width: 1280, height: 960 }), {
    width: 1440,
    height: 1080,
  });
  assert.deepEqual(getOutputDimensions('source', '720p', { width: 1080, height: 1920 }), {
    width: 720,
    height: 1280,
  });
  assert.equal(formatSimplifiedRatio(1080, 1080), '1:1');
  assert.equal(formatSimplifiedRatio(1280, 960), '4:3');
  assert.equal(formatSimplifiedRatio(1080, 1350), '4:5');
});
