import {
  ALL_FORMATS,
  BlobSource,
  BufferTarget,
  EncodedAudioPacketSource,
  EncodedPacket,
  EncodedVideoPacketSource,
  Input,
  Mp4OutputFormat,
  Output,
  VideoSampleSink,
  type AudioCodec,
  type VideoSample,
} from 'mediabunny';
import { renderStudioFrame, type BackgroundDrawable } from '../canvas/renderFrame';
import { getOutputDimensions } from '../constants/presets';
import type {
  AspectRatioId,
  BassSettings,
  ComputedAnalysis,
  ExportSettings,
  GradientSettings,
  MediaSourceState,
  VisualizerSettings,
  WebCodecsCapability,
} from '../types/studio';

export interface ExportRunOptions {
  aspectRatio: AspectRatioId;
  exportSettings: ExportSettings;
  media: MediaSourceState;
  audioBuffer: AudioBuffer;
  analysis: ComputedAnalysis;
  bass: BassSettings;
  visualizer: VisualizerSettings;
  gradient: GradientSettings;
  signal: AbortSignal;
  onProgress: (info: {
    status: 'preparing' | 'rendering' | 'muxing';
    progress: number;
    currentFrame: number;
    totalFrames: number;
    elapsedSeconds: number;
    etaSeconds: number;
    message: string;
  }) => void;
}

export interface ExportRunResult {
  blob: Blob;
  fileName: string;
  durationSeconds: number;
  totalFrames: number;
}

const AVC_CANDIDATE_CODECS = [
  'avc1.640028', // High Profile L4.0 (as specified)
  'avc1.64002a', // High Profile L4.2 (1080p60)
  'avc1.4d002a', // Main Profile L4.2
  'avc1.4d0028', // Main Profile L4.0
  'avc1.42E01F', // Baseline L3.1
  'avc1.42001E', // Baseline L3.0
] as const;

export async function checkWebCodecsCapability(
  width = 1920,
  height = 1080,
  fps = 60,
): Promise<WebCodecsCapability> {
  const videoEncoderOk = typeof VideoEncoder !== 'undefined';
  const audioEncoderOk = typeof AudioEncoder !== 'undefined';
  const videoDecoderOk = typeof VideoDecoder !== 'undefined';
  const frameOk = typeof VideoFrame !== 'undefined' && typeof AudioData !== 'undefined';
  const offscreenOk = typeof OffscreenCanvas !== 'undefined';

  if (!videoEncoderOk || !audioEncoderOk || !frameOk || !offscreenOk) {
    return {
      supported: false,
      videoEncoder: videoEncoderOk,
      audioEncoder: audioEncoderOk,
      videoDecoder: videoDecoderOk,
      h264Supported: false,
      aacSupported: false,
      opusSupported: false,
      reason: 'เบราว์เซอร์นี้ไม่รองรับ WebCodecs API หรือ OffscreenCanvas (แนะนำ Chrome / Edge เวอร์ชันล่าสุด)',
    };
  }

  let h264Supported = false;
  for (const codec of AVC_CANDIDATE_CODECS) {
    try {
      const res = await VideoEncoder.isConfigSupported({
        codec,
        width,
        height,
        bitrate: 8_000_000,
        framerate: fps,
        avc: { format: 'avc' },
      });
      if (res.supported) {
        h264Supported = true;
        break;
      }
    } catch {
      // Try next candidate
    }
  }

  let aacSupported = false;
  try {
    const res = await AudioEncoder.isConfigSupported({
      codec: 'mp4a.40.2',
      sampleRate: 48000,
      numberOfChannels: 2,
      bitrate: 192_000,
      aac: { format: 'aac' },
    });
    aacSupported = Boolean(res.supported);
  } catch {
    aacSupported = false;
  }

  let opusSupported = false;
  try {
    const res = await AudioEncoder.isConfigSupported({
      codec: 'opus',
      sampleRate: 48000,
      numberOfChannels: 2,
      bitrate: 192_000,
    });
    opusSupported = Boolean(res.supported);
  } catch {
    opusSupported = false;
  }

  const supported = h264Supported && (aacSupported || opusSupported);
  return {
    supported,
    videoEncoder: videoEncoderOk,
    audioEncoder: audioEncoderOk,
    videoDecoder: videoDecoderOk,
    h264Supported,
    aacSupported,
    opusSupported,
    reason: supported
      ? undefined
      : 'ไม่พบตัวเข้ารหัส H.264 หรือ AAC/Opus ใน WebCodecs ของเบราว์เซอร์นี้',
  };
}

async function resolveVideoEncoderConfig(
  width: number,
  height: number,
  fps: number,
  bitrate: number,
): Promise<VideoEncoderConfig> {
  const ordered =
    fps >= 50
      ? ['avc1.64002a', 'avc1.640028', 'avc1.4d002a', 'avc1.4d0028', 'avc1.42E02A', 'avc1.42E01E']
      : [...AVC_CANDIDATE_CODECS];

  for (const codec of ordered) {
    const cfg: VideoEncoderConfig = {
      codec,
      width,
      height,
      bitrate,
      framerate: fps,
      bitrateMode: 'variable',
      avc: { format: 'avc' },
    };
    try {
      const support = await VideoEncoder.isConfigSupported(cfg);
      if (support.supported) {
        return cfg;
      }
    } catch {
      // Try fallback without optional fields
      try {
        const basicCfg: VideoEncoderConfig = {
          codec,
          width,
          height,
          bitrate,
          framerate: fps,
          avc: { format: 'avc' },
        };
        const support = await VideoEncoder.isConfigSupported(basicCfg);
        if (support.supported) return basicCfg;
      } catch {
        // Continue
      }
    }
  }
  throw new Error('เบราว์เซอร์ไม่รองรับการเข้ารหัส H.264 (AVC) ที่ความละเอียดนี้');
}

async function resolveAudioEncoderConfig(
  sampleRate: number,
  numberOfChannels: number,
  bitrate: number,
): Promise<{ codecId: AudioCodec; config: AudioEncoderConfig }> {
  const aacCfg: AudioEncoderConfig = {
    codec: 'mp4a.40.2',
    sampleRate,
    numberOfChannels,
    bitrate,
    aac: { format: 'aac' },
  };
  try {
    const aacSupport = await AudioEncoder.isConfigSupported(aacCfg);
    if (aacSupport.supported) {
      return { codecId: 'aac', config: aacCfg };
    }
  } catch {
    // Fallback to Opus
  }

  const opusCfg: AudioEncoderConfig = {
    codec: 'opus',
    sampleRate: 48000,
    numberOfChannels,
    bitrate,
  };
  try {
    const opusSupport = await AudioEncoder.isConfigSupported(opusCfg);
    if (opusSupport.supported) {
      return { codecId: 'opus', config: opusCfg };
    }
  } catch {
    // No supported audio encoder
  }

  throw new Error('เบราว์เซอร์ไม่รองรับการเข้ารหัสเสียง AAC หรือ Opus ผ่าน WebCodecs');
}

async function normalizeAudioBufferForEncoding(
  source: AudioBuffer,
  targetSampleRate: number,
): Promise<AudioBuffer> {
  const targetChannels = Math.min(2, Math.max(1, source.numberOfChannels));
  if (
    source.sampleRate === targetSampleRate &&
    source.numberOfChannels === targetChannels
  ) {
    return source;
  }

  const targetFrames = Math.max(1, Math.ceil(source.duration * targetSampleRate));
  const offline = new OfflineAudioContext(targetChannels, targetFrames, targetSampleRate);
  const bufferSource = offline.createBufferSource();
  bufferSource.buffer = source;
  bufferSource.connect(offline.destination);
  bufferSource.start(0);
  return offline.startRendering();
}

function waitForEncoderDequeue(
  encoder: VideoEncoder | AudioEncoder,
  maxQueue: number,
  getError: () => unknown,
  signal: AbortSignal,
): Promise<void> {
  if (encoder.encodeQueueSize <= maxQueue) {
    return Promise.resolve();
  }
  return new Promise<void>((resolve, reject) => {
    const onAbort = () => {
      cleanup();
      reject(new DOMException('ผู้ใช้ยกเลิกการส่งออก', 'AbortError'));
    };
    const onDequeue = () => {
      const err = getError();
      if (err) {
        cleanup();
        reject(err instanceof Error ? err : new Error(String(err)));
        return;
      }
      if (encoder.encodeQueueSize <= maxQueue) {
        cleanup();
        resolve();
      }
    };
    const cleanup = () => {
      encoder.removeEventListener('dequeue', onDequeue);
      signal.removeEventListener('abort', onAbort);
    };
    signal.addEventListener('abort', onAbort, { once: true });
    encoder.addEventListener('dequeue', onDequeue);
  });
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) {
    throw new DOMException('ผู้ใช้ยกเลิกการส่งออก', 'AbortError');
  }
}

export async function exportStudioMp4(options: ExportRunOptions): Promise<ExportRunResult> {
  const {
    aspectRatio,
    exportSettings,
    media,
    audioBuffer,
    analysis,
    bass,
    visualizer,
    gradient,
    signal,
    onProgress,
  } = options;

  throwIfAborted(signal);
  const startMs = performance.now();

  const sourceSize =
    media.backgroundWidth > 0 && media.backgroundHeight > 0
      ? { width: media.backgroundWidth, height: media.backgroundHeight }
      : null;
  const { width, height } = getOutputDimensions(
    aspectRatio,
    exportSettings.resolution,
    sourceSize,
  );
  const fps = exportSettings.fps;
  const duration = Math.max(0.1, analysis.raw.duration);
  const totalFrames = analysis.raw.totalFrames;

  const isHdTier = Math.max(width, height) > 1280 || Math.min(width, height) >= 900;
  const videoBitrate = isHdTier
    ? exportSettings.bitrateQuality === 'high'
      ? fps === 60
        ? 14_000_000
        : 10_000_000
      : fps === 60
        ? 8_000_000
        : 6_000_000
    : exportSettings.bitrateQuality === 'high'
      ? fps === 60
        ? 8_500_000
        : 6_000_000
      : fps === 60
        ? 5_000_000
        : 3_500_000;

  const audioBitrate = exportSettings.bitrateQuality === 'high' ? 192_000 : 128_000;

  onProgress({
    status: 'preparing',
    progress: 0,
    currentFrame: 0,
    totalFrames,
    elapsedSeconds: 0,
    etaSeconds: 0,
    message: 'กำลังเตรียมตัวเข้ารหัส WebCodecs และทรัพยากรภาพ/วิดีโอ...',
  });

  const videoEncoderConfig = await resolveVideoEncoderConfig(width, height, fps, videoBitrate);
  const preferredSampleRate = audioBuffer.sampleRate === 44100 || audioBuffer.sampleRate === 48000
    ? audioBuffer.sampleRate
    : 48000;
  const targetChannels = Math.min(2, Math.max(1, audioBuffer.numberOfChannels));
  const audioChoice = await resolveAudioEncoderConfig(preferredSampleRate, targetChannels, audioBitrate);

  const normalizedAudio = await normalizeAudioBufferForEncoding(
    audioBuffer,
    audioChoice.config.sampleRate,
  );

  // OffscreenCanvas used as deterministic offline renderer
  const offscreen = new OffscreenCanvas(width, height);
  const ctx = offscreen.getContext('2d', { alpha: false });
  if (!ctx) {
    throw new Error('ไม่สามารถสร้าง OffscreenCanvas 2D Context ได้');
  }

  // Prepare image bitmap or Mediabunny video decoder
  let imageBitmap: ImageBitmap | null = null;
  let videoInput: Input | null = null;
  let videoSink: VideoSampleSink | null = null;
  let videoDuration = 0;

  if (media.backgroundType === 'image' && media.backgroundFile) {
    imageBitmap = await createImageBitmap(media.backgroundFile);
  } else if (media.backgroundType === 'video' && media.backgroundFile) {
    videoInput = new Input({
      source: new BlobSource(media.backgroundFile),
      formats: ALL_FORMATS,
    });
    const videoTrack = await videoInput.getPrimaryVideoTrack();
    if (!videoTrack) {
      throw new Error('ไม่พบแทร็กวิดีโอในไฟล์พื้นหลัง');
    }
    if (!(await videoTrack.canDecode())) {
      throw new Error('เบราว์เซอร์ไม่รองรับการถอดรหัสวิดีโอพื้นหลังผ่าน WebCodecs');
    }
    videoDuration = Math.max(0.05, (await videoTrack.computeDuration()) || media.backgroundDuration || duration);
    videoSink = new VideoSampleSink(videoTrack);
  }

  // Prepare Mediabunny MP4 Muxer
  const bufferTarget = new BufferTarget();
  const output = new Output({
    format: new Mp4OutputFormat({ fastStart: 'in-memory' }),
    target: bufferTarget,
  });

  const videoPacketSource = new EncodedVideoPacketSource('avc');
  const audioPacketSource = new EncodedAudioPacketSource(audioChoice.codecId);
  output.addVideoTrack(videoPacketSource, { frameRate: fps });
  output.addAudioTrack(audioPacketSource);

  let encoderError: unknown = null;
  let videoMuxChain = Promise.resolve();
  let audioMuxChain = Promise.resolve();
  let sentVideoMeta = false;
  let sentAudioMeta = false;

  const videoEncoder = new VideoEncoder({
    output: (chunk, meta) => {
      const packet = EncodedPacket.fromEncodedChunk(chunk);
      const passedMeta = !sentVideoMeta && meta ? meta : undefined;
      if (passedMeta) sentVideoMeta = true;
      videoMuxChain = videoMuxChain.then(() => videoPacketSource.add(packet, passedMeta)).catch((e) => {
        if (!encoderError) encoderError = e;
      });
    },
    error: (err) => {
      if (!encoderError) encoderError = err;
    },
  });

  const audioEncoder = new AudioEncoder({
    output: (chunk, meta) => {
      const packet = EncodedPacket.fromEncodedChunk(chunk);
      const passedMeta = !sentAudioMeta && meta ? meta : undefined;
      if (passedMeta) sentAudioMeta = true;
      audioMuxChain = audioMuxChain.then(() => audioPacketSource.add(packet, passedMeta)).catch((e) => {
        if (!encoderError) encoderError = e;
      });
    },
    error: (err) => {
      if (!encoderError) encoderError = err;
    },
  });

  // Track video decoder samples cleanly across loops
  const sampleState: {
    activeCycleIndex: number;
    cycleSampleIterator: AsyncGenerator<VideoSample | null, void, unknown> | null;
    heldLastSample: VideoSample | null;
    heldFirstSample: VideoSample | null;
  } = {
    activeCycleIndex: -1,
    cycleSampleIterator: null,
    heldLastSample: null,
    heldFirstSample: null,
  };

  const getFirstAvailableVideoSample = async (): Promise<VideoSample | null> => {
    if (sampleState.heldFirstSample) return sampleState.heldFirstSample;
    if (!videoSink) return null;
    for await (const s of videoSink.samples(0)) {
      sampleState.heldFirstSample = s;
      return sampleState.heldFirstSample;
    }
    return null;
  };

  const fetchSampleForFrame = async (frameIdx: number, tSec: number): Promise<VideoSample | null> => {
    if (!videoSink) return null;

    if (tSec >= videoDuration - 0.0005 && !media.loopVideo) {
      if (!sampleState.heldLastSample) {
        sampleState.heldLastSample = await videoSink.getSample(Math.max(0, videoDuration - 1 / fps));
      }
      return sampleState.heldLastSample ?? (await getFirstAvailableVideoSample());
    }

    const cycleIndex = media.loopVideo ? Math.floor(tSec / videoDuration) : 0;
    if (cycleIndex !== sampleState.activeCycleIndex || !sampleState.cycleSampleIterator) {
      if (sampleState.cycleSampleIterator) {
        await sampleState.cycleSampleIterator.return(undefined).catch(() => {});
        sampleState.cycleSampleIterator = null;
      }
      sampleState.activeCycleIndex = cycleIndex;

      // Build strictly monotonic timestamps for every frame in this exact loop cycle
      const cycleTimestamps: number[] = [];
      for (let f = frameIdx; f < totalFrames; f++) {
        const frameTime = f / fps;
        if (!media.loopVideo && frameTime >= videoDuration - 0.0005) break;
        const fCycle = media.loopVideo ? Math.floor(frameTime / videoDuration) : 0;
        if (fCycle !== cycleIndex) break;
        const localT = media.loopVideo
          ? Math.min(videoDuration - 0.0001, Math.max(0, frameTime - cycleIndex * videoDuration))
          : Math.min(videoDuration - 0.0001, frameTime);
        cycleTimestamps.push(localT);
      }

      if (cycleTimestamps.length === 0) {
        cycleTimestamps.push(0);
      }
      sampleState.cycleSampleIterator = videoSink.samplesAtTimestamps(cycleTimestamps);
    }

    const step = await sampleState.cycleSampleIterator.next();
    if (!step.done && step.value) {
      return step.value;
    }
    return await getFirstAvailableVideoSample();
  };

  try {
    videoEncoder.configure(videoEncoderConfig);
    audioEncoder.configure(audioChoice.config);
    await output.start();

    // Pre-build planar helper for audio chunk streaming
    const audioSampleRate = normalizedAudio.sampleRate;
    const audioChannels = normalizedAudio.numberOfChannels;
    const totalAudioSamples = normalizedAudio.length;
    const audioChunkFrames = 4096;
    let nextAudioSampleOffset = 0;

    const feedAudioUpToTime = async (targetTimeSec: number) => {
      const targetSampleOffset = Math.min(totalAudioSamples, Math.ceil(targetTimeSec * audioSampleRate));
      while (nextAudioSampleOffset < targetSampleOffset) {
        throwIfAborted(signal);
        if (encoderError) throw encoderError;

        const framesThisChunk = Math.min(audioChunkFrames, totalAudioSamples - nextAudioSampleOffset);
        const planar = new Float32Array(framesThisChunk * audioChannels);
        for (let ch = 0; ch < audioChannels; ch++) {
          const channelSlice = normalizedAudio
            .getChannelData(ch)
            .subarray(nextAudioSampleOffset, nextAudioSampleOffset + framesThisChunk);
          planar.set(channelSlice, ch * framesThisChunk);
        }

        const audioTimestampUs = Math.round((nextAudioSampleOffset * 1_000_000) / audioSampleRate);
        const audioData = new AudioData({
          format: 'f32-planar',
          sampleRate: audioSampleRate,
          numberOfFrames: framesThisChunk,
          numberOfChannels: audioChannels,
          timestamp: audioTimestampUs,
          data: planar,
        });

        try {
          audioEncoder.encode(audioData);
        } finally {
          audioData.close();
        }

        nextAudioSampleOffset += framesThisChunk;
        if (audioEncoder.encodeQueueSize > 16) {
          await waitForEncoderDequeue(audioEncoder, 12, () => encoderError, signal);
        }
      }
    };

    const frameDurationUs = Math.round(1_000_000 / fps);
    const keyFramePeriod = fps * 2; // Keyframe every 2 seconds

    for (let i = 0; i < totalFrames; i++) {
      throwIfAborted(signal);
      if (encoderError) throw encoderError;

      const tSec = i / fps;
      let frameSample: VideoSample | null = null;
      let backgroundDrawable: BackgroundDrawable = { kind: 'none' };

      if (imageBitmap) {
        backgroundDrawable = {
          kind: 'image',
          source: imageBitmap,
          width: imageBitmap.width,
          height: imageBitmap.height,
        };
      } else if (videoSink) {
        frameSample = await fetchSampleForFrame(i, tSec);
        if (frameSample) {
          const s = frameSample;
          backgroundDrawable = {
            kind: 'custom',
            width: s.displayWidth,
            height: s.displayHeight,
            draw: (targetCtx, dx, dy, dw, dh) => {
              s.draw(targetCtx, dx, dy, dw, dh);
            },
          };
        }
      }

      try {
        renderStudioFrame({
          ctx,
          width,
          height,
          frameIndex: i,
          analysis,
          background: backgroundDrawable,
          imageFit: media.imageFit,
          bleedPercent: media.bleedPercent,
          bass,
          visualizer,
          gradient,
        });
      } finally {
        if (
          frameSample &&
          frameSample !== sampleState.heldLastSample &&
          frameSample !== sampleState.heldFirstSample
        ) {
          frameSample.close();
        }
      }

      const timestampUs = Math.round((i * 1_000_000) / fps);
      const videoFrame = new VideoFrame(offscreen, {
        timestamp: timestampUs,
        duration: frameDurationUs,
      });

      try {
        videoEncoder.encode(videoFrame, {
          keyFrame: i % keyFramePeriod === 0,
        });
      } finally {
        videoFrame.close();
      }

      // Backpressure check specified: await if encodeQueueSize > 10
      if (videoEncoder.encodeQueueSize > 10) {
        await waitForEncoderDequeue(videoEncoder, 8, () => encoderError, signal);
      }

      // Interleave audio encoding cleanly alongside video timestamps
      await feedAudioUpToTime(tSec + 1 / fps);

      if (i % 4 === 0 || i === totalFrames - 1) {
        const elapsed = (performance.now() - startMs) / 1000;
        const pct = Math.min(95, Math.round(((i + 1) / totalFrames) * 95));
        const rate = (i + 1) / Math.max(0.05, elapsed);
        const remainingFrames = Math.max(0, totalFrames - (i + 1));
        const eta = rate > 0 ? remainingFrames / rate : 0;

        onProgress({
          status: 'rendering',
          progress: pct,
          currentFrame: i + 1,
          totalFrames,
          elapsedSeconds: elapsed,
          etaSeconds: eta,
          message: `กำลังเรนเดอร์เฟรม ${i + 1} / ${totalFrames}`,
        });

        // Yield to UI event loop so progress updates & cancel button stay crisp
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
      }
    }

    // Feed any remaining tail audio samples
    await feedAudioUpToTime(audioBuffer.duration + 0.5);

    onProgress({
      status: 'muxing',
      progress: 96,
      currentFrame: totalFrames,
      totalFrames,
      elapsedSeconds: (performance.now() - startMs) / 1000,
      etaSeconds: 1,
      message: 'กำลัง Flush ตัวเข้ารหัสและรวมแทร็กภาพ+เสียงเป็นไฟล์ MP4...',
    });

    await Promise.all([videoEncoder.flush(), audioEncoder.flush()]);
    if (encoderError) throw encoderError;

    await Promise.all([videoMuxChain, audioMuxChain]);
    if (encoderError) throw encoderError;

    await output.finalize();

    const finalBuffer = bufferTarget.buffer;
    if (!finalBuffer || finalBuffer.byteLength === 0) {
      throw new Error('ไฟล์ MP4 ที่รวมได้มีขนาดว่างเปล่า');
    }

    const blob = new Blob([finalBuffer], { type: 'video/mp4' });
    const baseName =
      media.customAudioFileName ||
      media.backgroundFileName ||
      'PulseSync_Project';
    const cleanBase = baseName.replace(/\.[^.]+$/, '').replace(/[^\w\u0E00-\u0E7F-]+/g, '_');
    const fileName = `${cleanBase}_PulseSync_${exportSettings.resolution}_${fps}fps.mp4`;

    return {
      blob,
      fileName,
      durationSeconds: duration,
      totalFrames,
    };
  } finally {
    if (sampleState.cycleSampleIterator) {
      await sampleState.cycleSampleIterator.return(undefined).catch(() => {});
    }
    if (sampleState.heldLastSample) {
      sampleState.heldLastSample.close();
    }
    if (sampleState.heldFirstSample) {
      sampleState.heldFirstSample.close();
    }
    if (imageBitmap) {
      imageBitmap.close();
    }
    if (videoInput) {
      videoInput.dispose();
    }
    if (videoEncoder.state !== 'closed') {
      videoEncoder.close();
    }
    if (audioEncoder.state !== 'closed') {
      audioEncoder.close();
    }
  }
}
