import { ALL_FORMATS, AudioBufferSink, BlobSource, Input } from 'mediabunny';

/**
 * Decodes an audio or video file into a Web Audio `AudioBuffer` entirely client-side.
 * Falls back to Mediabunny `AudioBufferSink` when native `decodeAudioData` cannot demux a container.
 */
export async function decodeMediaAudioBuffer(file: File): Promise<AudioBuffer> {
  const arrayBuffer = await file.arrayBuffer();

  // Primary path: browser native decodeAudioData via OfflineAudioContext / AudioContext
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (AudioCtx) {
    const tempCtx = new AudioCtx();
    try {
      const copied = arrayBuffer.slice(0);
      const decoded = await tempCtx.decodeAudioData(copied);
      return decoded;
    } catch {
      // Fall through to Mediabunny AudioBufferSink
    } finally {
      await tempCtx.close().catch(() => {});
    }
  }

  // Secondary path: Mediabunny container demux + WebCodecs AudioDecoder
  const input = new Input({
    source: new BlobSource(file),
    formats: ALL_FORMATS,
  });

  try {
    const audioTrack = await input.getPrimaryAudioTrack();
    if (!audioTrack) {
      throw new Error('ไม่พบแทร็กเสียงในไฟล์ที่เลือก');
    }

    const canDecode = await audioTrack.canDecode();
    if (!canDecode) {
      throw new Error('เบราว์เซอร์ไม่รองรับการถอดรหัสเสียงของไฟล์นี้');
    }

    const sampleRate = await audioTrack.getSampleRate();
    const channels = await audioTrack.getNumberOfChannels();
    const sink = new AudioBufferSink(audioTrack);

    const chunks: AudioBuffer[] = [];
    let totalFrames = 0;

    for await (const wrapped of sink.buffers(0)) {
      chunks.push(wrapped.buffer);
      totalFrames += wrapped.buffer.length;
    }

    if (totalFrames === 0) {
      throw new Error('แทร็กเสียงว่างเปล่า');
    }

    const offline = new OfflineAudioContext(channels, totalFrames, sampleRate);
    const merged = offline.createBuffer(channels, totalFrames, sampleRate);

    let offset = 0;
    for (const chunk of chunks) {
      for (let ch = 0; ch < channels; ch++) {
        const srcData = chunk.getChannelData(Math.min(ch, chunk.numberOfChannels - 1));
        merged.getChannelData(ch).set(srcData, offset);
      }
      offset += chunk.length;
    }

    return merged;
  } finally {
    input.dispose();
  }
}

/**
 * Downmixes a multi-channel AudioBuffer into a clean mono Float32Array for FFT analysis.
 */
export function mixAudioBufferToMono(audioBuffer: AudioBuffer): Float32Array {
  const { numberOfChannels, length } = audioBuffer;
  const mono = new Float32Array(length);
  if (numberOfChannels === 1) {
    mono.set(audioBuffer.getChannelData(0));
    return mono;
  }

  const gain = 1 / numberOfChannels;
  for (let ch = 0; ch < numberOfChannels; ch++) {
    const channelData = audioBuffer.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      mono[i]! += channelData[i]! * gain;
    }
  }
  return mono;
}

/**
 * Inspects a video file with Mediabunny to read metadata accurately without loading all frames.
 */
export async function probeVideoFileMetadata(file: File): Promise<{
  width: number;
  height: number;
  duration: number;
  hasAudio: boolean;
}> {
  const input = new Input({
    source: new BlobSource(file),
    formats: ALL_FORMATS,
  });

  try {
    const [videoTrack, audioTrack, duration] = await Promise.all([
      input.getPrimaryVideoTrack(),
      input.getPrimaryAudioTrack(),
      input.computeDuration(),
    ]);

    if (!videoTrack) {
      throw new Error('ไม่พบแทร็กวิดีโอในไฟล์ที่อัปโหลด');
    }

    const width = videoTrack.displayWidth;
    const height = videoTrack.displayHeight;

    return {
      width,
      height,
      duration,
      hasAudio: audioTrack !== null,
    };
  } finally {
    input.dispose();
  }
}

/**
 * Generates a self-contained procedural demo package (12s 124 BPM synthwave WAV + 1920x1080 artwork PNG)
 * so anyone opening the web app can test Bass Reactivity, all 15 Visualizers, and MP4 export in 1 click.
 */
export async function createDemoProjectAssets(): Promise<{
  imageFile: File;
  audioFile: File;
}> {
  const sampleRate = 44100;
  const durationSec = 12;
  const totalSamples = sampleRate * durationSec;
  const bpm = 124;
  const beatSec = 60 / bpm;

  const left = new Float32Array(totalSamples);
  const right = new Float32Array(totalSamples);

  const chordProg = [
    [220.0, 261.63, 329.63, 440.0], // Am
    [174.61, 220.0, 261.63, 349.23], // F
    [130.81 * 2, 329.63, 392.0, 523.25], // C
    [196.0, 246.94, 293.66, 392.0], // G
  ];

  const arpNotes = [523.25, 659.25, 783.99, 1046.5, 880.0, 783.99, 659.25, 587.33];

  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    const beatPos = t / beatSec;
    const beatIndex = Math.floor(beatPos);
    const beatFrac = beatPos - beatIndex;
    const beatTime = beatFrac * beatSec;

    // 1. Punchy 55 Hz Kick Drum on every beat (strictly triggers 20-140 Hz bass engine)
    const kickEnv = Math.exp(-beatTime * 11.5);
    const kickFreq = 46 + 98 * Math.exp(-beatTime * 34);
    const kick = Math.sin(2 * Math.PI * kickFreq * beatTime) * kickEnv * 0.78;

    // 2. Melodic Chord Pad (220 - 600 Hz)
    const barIdx = Math.floor(beatIndex / 4) % chordProg.length;
    const chord = chordProg[barIdx]!;
    let pad = 0;
    for (let c = 0; c < chord.length; c++) {
      const f = chord[c]!;
      pad += Math.sin(2 * Math.PI * f * t) * 0.08 + Math.sin(2 * Math.PI * f * 2 * t) * 0.025;
    }

    // 3. Plucky 16th-note Synth Arp (500 - 4000 Hz)
    const sixteenthPos = beatPos * 4;
    const sixteenthIdx = Math.floor(sixteenthPos);
    const sixteenthTime = (sixteenthPos - sixteenthIdx) * (beatSec / 4);
    const arpFreq = arpNotes[sixteenthIdx % arpNotes.length]!;
    const arpEnv = Math.exp(-sixteenthTime * 18);
    const arp =
      (Math.sin(2 * Math.PI * arpFreq * t) * 0.14 +
        Math.sin(2 * Math.PI * arpFreq * 2 * t) * 0.06 +
        Math.sin(2 * Math.PI * arpFreq * 3 * t) * 0.025) *
      arpEnv;

    // 4. Crisp off-beat Hi-hat shimmer (5000 - 11000 Hz)
    const hatFrac = (beatPos + 0.5) % 1;
    const hatTime = hatFrac * beatSec;
    const hatEnv = Math.exp(-hatTime * 42);
    const pseudoNoise = Math.sin(i * 12.9898) * 43758.5453;
    const noiseVal = (pseudoNoise - Math.floor(pseudoNoise)) * 2 - 1;
    const hat = noiseVal * hatEnv * 0.09;

    // Stereo spread on melodic layer, mono tight kick
    const stereoPad = Math.sin(t * 1.4) * 0.04;
    const sampleL = kick + pad + arp * (1 + stereoPad) + hat;
    const sampleR = kick + pad + arp * (1 - stereoPad) - hat * 0.6;

    // Soft limiter + fade out at end
    const fadeOut = t > durationSec - 0.5 ? Math.max(0, (durationSec - t) / 0.5) : 1;
    left[i] = Math.tanh(sampleL * 0.92) * fadeOut;
    right[i] = Math.tanh(sampleR * 0.92) * fadeOut;
  }

  const wavBlob = encodeStereoWavBlob(left, right, sampleRate);
  const audioFile = new File([wavBlob], 'PulseSync_Demo_124BPM.wav', { type: 'audio/wav' });

  // Generate sleek 1920x1080 abstract cyber-studio background PNG
  const artCanvas = document.createElement('canvas');
  artCanvas.width = 1920;
  artCanvas.height = 1080;
  const ctx = artCanvas.getContext('2d')!;

  const bgGrad = ctx.createLinearGradient(0, 0, 1920, 1080);
  bgGrad.addColorStop(0, '#070B16');
  bgGrad.addColorStop(0.45, '#131633');
  bgGrad.addColorStop(1, '#1E0B2C');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 1920, 1080);

  // Ambient neon stage glows
  const glow1 = ctx.createRadialGradient(480, 320, 40, 480, 320, 620);
  glow1.addColorStop(0, 'rgba(0, 245, 255, 0.28)');
  glow1.addColorStop(1, 'rgba(0, 245, 255, 0)');
  ctx.fillStyle = glow1;
  ctx.fillRect(0, 0, 1920, 1080);

  const glow2 = ctx.createRadialGradient(1420, 680, 40, 1420, 680, 680);
  glow2.addColorStop(0, 'rgba(255, 0, 170, 0.26)');
  glow2.addColorStop(1, 'rgba(255, 0, 170, 0)');
  ctx.fillStyle = glow2;
  ctx.fillRect(0, 0, 1920, 1080);

  // Perspective grid horizon lines
  ctx.strokeStyle = 'rgba(123, 47, 255, 0.22)';
  ctx.lineWidth = 2;
  const horizonY = 640;
  for (let row = 0; row < 12; row++) {
    const y = horizonY + Math.pow(row / 11, 1.8) * 440;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(1920, y);
    ctx.stroke();
  }
  for (let col = -12; col <= 12; col++) {
    ctx.beginPath();
    ctx.moveTo(960 + col * 52, horizonY);
    ctx.lineTo(960 + col * 240, 1080);
    ctx.stroke();
  }

  // Geometric skyline silhouettes
  const skylineColors = ['#0D1224', '#111730'];
  ctx.fillStyle = skylineColors[0]!;
  for (let x = 0; x < 1920; x += 96) {
    const h = 90 + ((Math.sin(x * 0.017) + 1) * 0.5) * 210;
    ctx.fillRect(x + 4, horizonY - h, 88, h);
  }

  // Subtle studio watermark label
  ctx.fillStyle = 'rgba(226, 232, 240, 0.72)';
  ctx.font = '600 42px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('PULSESYNC DEMO STAGE • 124 BPM', 960, 220);
  ctx.fillStyle = 'rgba(103, 232, 249, 0.65)';
  ctx.font = '500 22px monospace';
  ctx.fillText('SUB-BASS KICK 55 HZ  |  MELODIC SYNTH 220 - 11,000 HZ', 960, 266);

  const pngBlob = await new Promise<Blob>((resolve, reject) => {
    artCanvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('สร้างภาพตัวอย่างไม่สำเร็จ'));
    }, 'image/png');
  });

  const imageFile = new File([pngBlob], 'PulseSync_Demo_Stage.png', { type: 'image/png' });
  return { imageFile, audioFile };
}

function encodeStereoWavBlob(left: Float32Array, right: Float32Array, sampleRate: number): Blob {
  const numChannels = 2;
  const bitsPerSample = 16;
  const frameCount = left.length;
  const dataSize = frameCount * numChannels * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, (sampleRate * numChannels * bitsPerSample) / 8, true);
  view.setUint16(32, (numChannels * bitsPerSample) / 8, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  let pos = 44;
  for (let i = 0; i < frameCount; i++) {
    const l = Math.max(-1, Math.min(1, left[i]!));
    const r = Math.max(-1, Math.min(1, right[i]!));
    view.setInt16(pos, l < 0 ? l * 0x8000 : l * 0x7fff, true);
    view.setInt16(pos + 2, r < 0 ? r * 0x8000 : r * 0x7fff, true);
    pos += 4;
  }

  return new Blob([buffer], { type: 'audio/wav' });
}
