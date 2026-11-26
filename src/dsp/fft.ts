export const FFT_SIZE = 4096;
export const MELODIC_BIN_COUNT = 64;
export const OSC_SAMPLE_COUNT = 96;
export const MELODIC_MIN_HZ = 160;
export const MELODIC_MAX_HZ = 16000;

/**
 * 12 sub-band upper frequency edges covering 20 Hz - 160 Hz.
 * Enables instant bass cutoff adjustment (60 - 160 Hz) without re-running FFT.
 */
export const BASS_SUB_BAND_HZ: readonly number[] = [
  25, 35, 45, 55, 65, 78, 92, 106, 120, 134, 148, 160,
];

export interface FftWorkspace {
  size: number;
  hannWindow: Float32Array;
  bitReversed: Uint32Array;
  cosTable: Float32Array;
  sinTable: Float32Array;
  real: Float32Array;
  imag: Float32Array;
  magnitudes: Float32Array;
}

export function createFftWorkspace(size: number = FFT_SIZE): FftWorkspace {
  if ((size & (size - 1)) !== 0 || size < 16) {
    throw new Error(`FFT size must be a power of 2 >= 16, received ${size}`);
  }

  const hannWindow = new Float32Array(size);
  for (let i = 0; i < size; i++) {
    hannWindow[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (size - 1)));
  }

  const bits = Math.round(Math.log2(size));
  const bitReversed = new Uint32Array(size);
  for (let i = 0; i < size; i++) {
    let rev = 0;
    let n = i;
    for (let b = 0; b < bits; b++) {
      rev = (rev << 1) | (n & 1);
      n >>= 1;
    }
    bitReversed[i] = rev;
  }

  const half = size >> 1;
  const cosTable = new Float32Array(half);
  const sinTable = new Float32Array(half);
  for (let i = 0; i < half; i++) {
    const angle = (-2 * Math.PI * i) / size;
    cosTable[i] = Math.cos(angle);
    sinTable[i] = Math.sin(angle);
  }

  return {
    size,
    hannWindow,
    bitReversed,
    cosTable,
    sinTable,
    real: new Float32Array(size),
    imag: new Float32Array(size),
    magnitudes: new Float32Array(half),
  };
}

/**
 * In-place Radix-2 Cooley-Tukey FFT on a centered Hann-windowed slice of `pcm`.
 * Populates `ws.magnitudes` with normalized single-sided amplitude spectrum [0..size/2).
 */
export function computeFrameSpectrum(
  pcm: Float32Array,
  centerSample: number,
  ws: FftWorkspace,
): Float32Array {
  const n = ws.size;
  const half = n >> 1;
  const start = centerSample - half;
  const { real, imag, bitReversed, hannWindow, cosTable, sinTable, magnitudes } = ws;

  for (let i = 0; i < n; i++) {
    const srcIdx = start + i;
    const sample = srcIdx >= 0 && srcIdx < pcm.length ? pcm[srcIdx]! : 0;
    real[bitReversed[i]!] = sample * hannWindow[i]!;
    imag[i] = 0;
  }

  for (let stageSize = 2; stageSize <= n; stageSize <<= 1) {
    const halfStage = stageSize >> 1;
    const tableStep = n / stageSize;
    for (let group = 0; group < n; group += stageSize) {
      for (let pair = 0; pair < halfStage; pair++) {
        const k = pair * tableStep;
        const cos = cosTable[k]!;
        const sin = sinTable[k]!;
        const evenIdx = group + pair;
        const oddIdx = evenIdx + halfStage;
        const oddRe = real[oddIdx]!;
        const oddIm = imag[oddIdx]!;
        const tRe = oddRe * cos - oddIm * sin;
        const tIm = oddRe * sin + oddIm * cos;

        real[oddIdx] = real[evenIdx]! - tRe;
        imag[oddIdx] = imag[evenIdx]! - tIm;
        real[evenIdx] = real[evenIdx]! + tRe;
        imag[evenIdx] = imag[evenIdx]! + tIm;
      }
    }
  }

  // Hann coherent gain compensation = 2 / (n * 0.5) = 4 / n
  const scale = 4 / n;
  for (let i = 0; i < half; i++) {
    const re = real[i]!;
    const im = imag[i]!;
    magnitudes[i] = Math.hypot(re, im) * scale;
  }

  return magnitudes;
}

/**
 * 4th-order Butterworth High-Pass Filter (two cascaded 2nd-order biquads) at cutoffHz (default 160 Hz).
 * Used to produce a clean bass-free time-domain waveform for the High-Pass Oscilloscope style.
 */
export function applyButterworthHighPass(
  pcm: Float32Array,
  sampleRate: number,
  cutoffHz: number = MELODIC_MIN_HZ,
): Float32Array {
  const out = new Float32Array(pcm.length);
  if (pcm.length === 0 || sampleRate <= cutoffHz * 2.2) {
    out.set(pcm);
    return out;
  }

  const qStages = [0.5411961, 1.3065630];
  let input = pcm;

  for (let s = 0; s < qStages.length; s++) {
    const stageOut = s === qStages.length - 1 ? out : new Float32Array(pcm.length);
    const omega = (2 * Math.PI * cutoffHz) / sampleRate;
    const cosW = Math.cos(omega);
    const sinW = Math.sin(omega);
    const alpha = sinW / (2 * qStages[s]!);
    const norm = 1 / (1 + alpha);

    const b0 = ((1 + cosW) * 0.5) * norm;
    const b1 = -(1 + cosW) * norm;
    const b2 = b0;
    const a1 = (-2 * cosW) * norm;
    const a2 = (1 - alpha) * norm;

    let x1 = 0;
    let x2 = 0;
    let y1 = 0;
    let y2 = 0;

    for (let i = 0; i < input.length; i++) {
      const x0 = input[i]!;
      const y0 = b0 * x0 + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
      stageOut[i] = y0;
      x2 = x1;
      x1 = x0;
      y2 = y1;
      y1 = y0;
    }
    input = stageOut;
  }

  return out;
}

export interface MelodicBandRange {
  startBin: number;
  endBin: number;
  centerHz: number;
  tiltGain: number;
}

/**
 * Maps 64 logarithmic frequency bands strictly inside [160 Hz, 16,000 Hz].
 * Hard high-pass bin masking: every FFT bin < 160 Hz is excluded completely.
 */
export function buildMelodicBandMap(
  sampleRate: number,
  fftSize: number = FFT_SIZE,
  bandCount: number = MELODIC_BIN_COUNT,
): MelodicBandRange[] {
  const binHz = sampleRate / fftSize;
  const maxUsableHz = Math.min(MELODIC_MAX_HZ, sampleRate * 0.48);
  const minValidBin = Math.ceil(MELODIC_MIN_HZ / binHz); // Strictly >= 160 Hz
  const maxValidBin = Math.min((fftSize >> 1) - 1, Math.floor(maxUsableHz / binHz));

  const bands: MelodicBandRange[] = [];
  const ratio = maxUsableHz / MELODIC_MIN_HZ;

  for (let k = 0; k < bandCount; k++) {
    const fLow = MELODIC_MIN_HZ * Math.pow(ratio, k / bandCount);
    const fHigh = MELODIC_MIN_HZ * Math.pow(ratio, (k + 1) / bandCount);
    const centerHz = Math.sqrt(fLow * fHigh);

    let startBin = Math.max(minValidBin, Math.floor(fLow / binHz));
    let endBin = Math.min(maxValidBin, Math.ceil(fHigh / binHz));
    if (endBin < startBin) {
      startBin = Math.min(maxValidBin, Math.max(minValidBin, Math.round(centerHz / binHz)));
      endBin = startBin;
    }

    // Gentle psychoacoustic high-frequency tilt (+2.8 dB/octave above 400 Hz)
    const octavesAbove400 = Math.max(0, Math.log2(centerHz / 400));
    const tiltGain = Math.pow(10, (octavesAbove400 * 2.4) / 20);

    bands.push({ startBin, endBin, centerHz, tiltGain });
  }

  return bands;
}
