import {
  applyButterworthHighPass,
  BASS_SUB_BAND_HZ,
  buildMelodicBandMap,
  computeFrameSpectrum,
  createFftWorkspace,
  FFT_SIZE,
  MELODIC_BIN_COUNT,
  OSC_SAMPLE_COUNT,
} from '../dsp/fft';
import type { FrameRateOption, RawSpectrumData } from '../types/studio';

export interface DspWorkerRequest {
  requestId: number;
  pcm: Float32Array;
  sampleRate: number;
  fps: FrameRateOption;
  duration: number;
}

export type DspWorkerResponse =
  | { type: 'progress'; requestId: number; progress: number }
  | { type: 'result'; requestId: number; raw: RawSpectrumData }
  | { type: 'error'; requestId: number; message: string };

self.onmessage = (event: MessageEvent<DspWorkerRequest>) => {
  const { requestId, pcm, sampleRate, fps, duration } = event.data;

  try {
    const totalFrames = Math.max(1, Math.ceil(duration * fps));
    const bassSubBandCount = BASS_SUB_BAND_HZ.length;
    const bassSubEnergies = new Float32Array(totalFrames * bassSubBandCount);
    const melodicBins = new Float32Array(totalFrames * MELODIC_BIN_COUNT);
    const oscilloscopeSlices = new Float32Array(totalFrames * OSC_SAMPLE_COUNT);

    // 1. High-pass filter PCM at 160 Hz for deterministic High-Pass Oscilloscope
    const highPassedPcm = applyButterworthHighPass(pcm, sampleRate, 160);

    // 2. Prepare FFT workspace & logarithmic melodic band map (>= 160 Hz strictly)
    const ws = createFftWorkspace(FFT_SIZE);
    const binHz = sampleRate / FFT_SIZE;
    const melodicMap = buildMelodicBandMap(sampleRate, FFT_SIZE, MELODIC_BIN_COUNT);

    // Precompute bass sub-band FFT bin ranges (20 Hz .. 160 Hz)
    const bassRanges = BASS_SUB_BAND_HZ.map((upperHz, idx) => {
      const lowerHz = idx === 0 ? 20 : BASS_SUB_BAND_HZ[idx - 1]!;
      const startBin = Math.max(1, Math.floor(lowerHz / binHz));
      const endBin = Math.max(startBin, Math.min((FFT_SIZE >> 1) - 1, Math.floor(upperHz / binHz)));
      return { startBin, endBin };
    });

    // Temporal smoothing state across melodic bands so curves move organically
    const prevMelodic = new Float32Array(MELODIC_BIN_COUNT);
    const dt = 1 / fps;
    const melodicAttack = 1 - Math.exp(-dt / 0.022);
    const melodicRelease = 1 - Math.exp(-dt / 0.095);

    const oscWindowSamples = Math.max(OSC_SAMPLE_COUNT, Math.round(sampleRate * 0.022));
    const progressStep = Math.max(1, Math.floor(totalFrames / 40));

    for (let i = 0; i < totalFrames; i++) {
      const timeSec = i / fps;
      const centerSample = Math.min(pcm.length - 1, Math.max(0, Math.round(timeSec * sampleRate)));

      // Compute FFT magnitude spectrum for frame i
      const mag = computeFrameSpectrum(pcm, centerSample, ws);

      // Fill 12 sub-bass band energies (20..160 Hz)
      const bassOffset = i * bassSubBandCount;
      for (let b = 0; b < bassSubBandCount; b++) {
        const { startBin, endBin } = bassRanges[b]!;
        let sumSq = 0;
        let count = 0;
        for (let bin = startBin; bin <= endBin; bin++) {
          const m = mag[bin]!;
          sumSq += m * m;
          count++;
        }
        bassSubEnergies[bassOffset + b] = count > 0 ? Math.sqrt(sumSq / count) : 0;
      }

      // Fill 64 melodic logarithmic bands (strictly >= 160 Hz)
      const melOffset = i * MELODIC_BIN_COUNT;
      for (let k = 0; k < MELODIC_BIN_COUNT; k++) {
        const range = melodicMap[k]!;
        let sumSq = 0;
        let count = 0;
        for (let bin = range.startBin; bin <= range.endBin; bin++) {
          const m = mag[bin]!;
          sumSq += m * m;
          count++;
        }
        const rms = count > 0 ? Math.sqrt(sumSq / count) * range.tiltGain : 0;
        // Convert to perceptual dB scale [-66 dB .. -10 dB] -> [0..1]
        const db = 20 * Math.log10(Math.max(rms, 1e-6));
        const normalized = Math.min(1, Math.max(0, (db + 66) / 56));
        const prev = prevMelodic[k]!;
        const alpha = normalized > prev ? melodicAttack : melodicRelease;
        const smoothed = prev + (normalized - prev) * alpha;
        prevMelodic[k] = smoothed;
        melodicBins[melOffset + k] = smoothed;
      }

      // Fill 96 high-pass time-domain samples for High-Pass Oscilloscope
      const oscOffset = i * OSC_SAMPLE_COUNT;
      const oscStart = centerSample - (oscWindowSamples >> 1);
      for (let s = 0; s < OSC_SAMPLE_COUNT; s++) {
        const srcPos = oscStart + Math.floor((s * oscWindowSamples) / OSC_SAMPLE_COUNT);
        const val = srcPos >= 0 && srcPos < highPassedPcm.length ? highPassedPcm[srcPos]! : 0;
        oscilloscopeSlices[oscOffset + s] = Math.max(-1, Math.min(1, val * 1.45));
      }

      if (i % progressStep === 0 || i === totalFrames - 1) {
        const progress = Math.round(((i + 1) / totalFrames) * 100);
        self.postMessage({ type: 'progress', requestId, progress } satisfies DspWorkerResponse);
      }
    }

    const raw: RawSpectrumData = {
      fps,
      duration,
      totalFrames,
      sampleRate,
      bassSubBandHz: [...BASS_SUB_BAND_HZ],
      bassSubEnergies,
      bassSubBandCount,
      melodicBins,
      melodicBinCount: MELODIC_BIN_COUNT,
      oscilloscopeSlices,
      oscSampleCount: OSC_SAMPLE_COUNT,
    };

    const transfer: Transferable[] = [
      bassSubEnergies.buffer,
      melodicBins.buffer,
      oscilloscopeSlices.buffer,
    ];

    (self as unknown as { postMessage: (msg: DspWorkerResponse, transfer: Transferable[]) => void }).postMessage(
      { type: 'result', requestId, raw },
      transfer,
    );
  } catch (err) {
    self.postMessage({
      type: 'error',
      requestId,
      message: err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการวิเคราะห์เสียง FFT',
    } satisfies DspWorkerResponse);
  }
};
