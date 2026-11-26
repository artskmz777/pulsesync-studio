import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createDemoProjectAssets,
  decodeMediaAudioBuffer,
  mixAudioBufferToMono,
  probeVideoFileMetadata,
} from './audio/decodeAudio';
import { renderStudioFrame, type BackgroundDrawable } from './canvas/renderFrame';
import { ExportModal } from './components/ExportModal';
import { HeaderBar } from './components/HeaderBar';
import { InspectorPanel } from './components/InspectorPanel';
import { MediaPanel } from './components/MediaPanel';
import { PreviewStage } from './components/PreviewStage';
import {
  DEFAULT_BASS_SETTINGS,
  DEFAULT_EXPORT_SETTINGS,
  DEFAULT_GRADIENT_SETTINGS,
  DEFAULT_VISUALIZER_SETTINGS,
  getOutputDimensions,
} from './constants/presets';
import { computeFrameAnalysis } from './dsp/envelope';
import { checkWebCodecsCapability, exportStudioMp4 } from './export/mp4Exporter';
import type {
  AnalysisSummary,
  AspectRatioId,
  AudioSourceMode,
  BassSettings,
  ComputedAnalysis,
  ExportProgressState,
  ExportSettings,
  GradientSettings,
  ImageFitMode,
  InspectorTabId,
  MediaSourceState,
  RawSpectrumData,
  VisualizerSettings,
  WebCodecsCapability,
} from './types/studio';
import type { DspWorkerRequest, DspWorkerResponse } from './workers/dspWorker';

const INITIAL_MEDIA: MediaSourceState = {
  backgroundType: 'none',
  backgroundFile: null,
  backgroundFileName: '',
  backgroundUrl: null,
  backgroundWidth: 0,
  backgroundHeight: 0,
  backgroundDuration: 0,
  imageFit: 'cover',
  bleedPercent: 0,
  loopVideo: true,
  videoHasAudio: false,
  audioSourceMode: 'video',
  customAudioFile: null,
  customAudioFileName: '',
};

const INITIAL_SUMMARY: AnalysisSummary = {
  status: 'idle',
  progress: 0,
  statusLabel: 'อัปโหลดไฟล์เสียงหรือกด "โหลดไฟล์ตัวอย่างทดสอบ" เพื่อเริ่มต้น',
  duration: 0,
  sampleRate: 44100,
  totalFrames: 0,
  estimatedBpm: 0,
  peakBassFrames: 0,
};

const INITIAL_EXPORT_MODAL: ExportProgressState = {
  isOpen: false,
  status: 'idle',
  progress: 0,
  currentFrame: 0,
  totalFrames: 0,
  elapsedSeconds: 0,
  etaSeconds: 0,
  message: '',
};

export function App(): React.ReactElement {
  // Studio configuration state
  const [aspectRatio, setAspectRatio] = useState<AspectRatioId>('16:9');
  const [activeTab, setActiveTab] = useState<InspectorTabId>('bass');
  const [bassSettings, setBassSettings] = useState<BassSettings>(DEFAULT_BASS_SETTINGS);
  const [visualizerSettings, setVisualizerSettings] = useState<VisualizerSettings>(
    DEFAULT_VISUALIZER_SETTINGS,
  );
  const [gradientSettings, setGradientSettings] = useState<GradientSettings>(
    DEFAULT_GRADIENT_SETTINGS,
  );
  const [exportSettings, setExportSettings] = useState<ExportSettings>(DEFAULT_EXPORT_SETTINGS);

  // Media & DSP state
  const [media, setMedia] = useState<MediaSourceState>(INITIAL_MEDIA);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [rawSpectrum, setRawSpectrum] = useState<RawSpectrumData | null>(null);
  const [analysisSummary, setAnalysisSummary] = useState<AnalysisSummary>(INITIAL_SUMMARY);
  const [isDemoLoading, setIsDemoLoading] = useState(false);

  // Live meters & playback transport state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(85);
  const [isMuted, setIsMuted] = useState(false);
  const [liveBassMeter, setLiveBassMeter] = useState(0);
  const [liveMelodicMeter, setLiveMelodicMeter] = useState(0);

  // WebCodecs capability & Export Modal
  const [capability, setCapability] = useState<WebCodecsCapability | null>(null);
  const [exportState, setExportState] = useState<ExportProgressState>(INITIAL_EXPORT_MODAL);

  // Refs for rendering, worker, audio playback & media elements
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageElementRef = useRef<HTMLImageElement | null>(null);
  const videoElementRef = useRef<HTMLVideoElement | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const workerReqIdRef = useRef(0);
  const monoPcmRef = useRef<{ pcm: Float32Array; sampleRate: number; duration: number } | null>(
    null,
  );
  const activeVideoUrlRef = useRef<string | null>(null);
  const activeImageUrlRef = useRef<string | null>(null);
  const exportAbortRef = useRef<AbortController | null>(null);

  // Web Audio playback refs
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const playStartCtxTimeRef = useRef(0);
  const playStartOffsetRef = useRef(0);
  const currentTimeRef = useRef(0);
  const isPlayingRef = useRef(false);
  const rafIdRef = useRef<number | null>(null);
  const lastUiSyncMsRef = useRef(0);

  // Computed frame envelopes (recomputes in < 5ms when BassSettings change)
  const computedAnalysis = useMemo<ComputedAnalysis | null>(() => {
    if (!rawSpectrum) return null;
    return computeFrameAnalysis(rawSpectrum, bassSettings);
  }, [rawSpectrum, bassSettings]);

  // Keep summary synchronized with envelope BPM/peak stats
  useEffect(() => {
    if (!computedAnalysis) return;
    setAnalysisSummary((prev) => ({
      ...prev,
      status: 'ready',
      progress: 100,
      statusLabel: `วิเคราะห์ FFT และย่านเบสเสร็จสมบูรณ์ (${computedAnalysis.raw.fps} FPS)`,
      duration: computedAnalysis.raw.duration,
      sampleRate: computedAnalysis.raw.sampleRate,
      totalFrames: computedAnalysis.raw.totalFrames,
      estimatedBpm: computedAnalysis.estimatedBpm,
      peakBassFrames: computedAnalysis.peakBassFrames,
    }));
  }, [computedAnalysis]);

  const sourceSize = useMemo(
    () =>
      media.backgroundWidth > 0 && media.backgroundHeight > 0
        ? { width: media.backgroundWidth, height: media.backgroundHeight }
        : null,
    [media.backgroundWidth, media.backgroundHeight],
  );

  // Check WebCodecs support whenever target dimensions/fps change
  useEffect(() => {
    let active = true;
    const { width, height } = getOutputDimensions(
      aspectRatio,
      exportSettings.resolution,
      sourceSize,
    );
    void checkWebCodecsCapability(width, height, exportSettings.fps).then((res) => {
      if (active) setCapability(res);
    });
    return () => {
      active = false;
    };
  }, [aspectRatio, exportSettings.resolution, exportSettings.fps, sourceSize]);

  // Spawn DSP Web Worker once on mount
  useEffect(() => {
    const worker = new Worker(new URL('./workers/dspWorker.ts', import.meta.url), {
      type: 'module',
    });
    workerRef.current = worker;

    worker.onmessage = (event: MessageEvent<DspWorkerResponse>) => {
      const msg = event.data;
      if (msg.requestId !== workerReqIdRef.current) return;

      if (msg.type === 'progress') {
        setAnalysisSummary((prev) => ({
          ...prev,
          status: 'analyzing',
          progress: msg.progress,
          statusLabel: `กำลังวิเคราะห์สเปกตรัม FFT แยก 2 ย่าน (${msg.progress}%)...`,
        }));
      } else if (msg.type === 'result') {
        setRawSpectrum(msg.raw);
      } else if (msg.type === 'error') {
        setAnalysisSummary((prev) => ({
          ...prev,
          status: 'error',
          statusLabel: 'วิเคราะห์เสียงไม่สำเร็จ',
          errorMessage: msg.message,
        }));
      }
    };

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  // Trigger Worker DSP whenever mono PCM or target FPS updates
  const dispatchWorkerAnalysis = useCallback(
    (pcmData: Float32Array, sampleRate: number, duration: number, fps: 30 | 60) => {
      const worker = workerRef.current;
      if (!worker) return;
      const reqId = ++workerReqIdRef.current;
      // Copy buffer before transferring so monoPcmRef stays intact if user switches 30 <-> 60 FPS
      const pcmCopy = new Float32Array(pcmData);
      setAnalysisSummary((prev) => ({
        ...prev,
        status: 'analyzing',
        progress: 0,
        statusLabel: `กำลังวิเคราะห์ FFT ${fps} FPS บน Web Worker...`,
        errorMessage: undefined,
      }));
      const payload: DspWorkerRequest = {
        requestId: reqId,
        pcm: pcmCopy,
        sampleRate,
        fps,
        duration,
      };
      worker.postMessage(payload, [pcmCopy.buffer]);
    },
    [],
  );

  // Re-run FFT automatically if user toggles 30 FPS <-> 60 FPS while audio is loaded
  useEffect(() => {
    const cached = monoPcmRef.current;
    if (!cached) return;
    if (rawSpectrum && rawSpectrum.fps === exportSettings.fps) return;
    dispatchWorkerAnalysis(cached.pcm, cached.sampleRate, cached.duration, exportSettings.fps);
  }, [exportSettings.fps, rawSpectrum, dispatchWorkerAnalysis]);

  // Helper to stop audio playback cleanly
  const stopAudioPlayback = useCallback(() => {
    isPlayingRef.current = false;
    setIsPlaying(false);
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    if (audioSourceRef.current) {
      try {
        audioSourceRef.current.onended = null;
        audioSourceRef.current.stop();
        audioSourceRef.current.disconnect();
      } catch {
        // Ignore already stopped source
      }
      audioSourceRef.current = null;
    }
    if (videoElementRef.current && !videoElementRef.current.paused) {
      videoElementRef.current.pause();
    }
  }, []);

  // Render a single frame onto the live preview canvas
  const paintPreviewAtTime = useCallback(
    (timeSec: number) => {
      const canvas = previewCanvasRef.current;
      if (!canvas) return;

      // Preview canvas runs at clean 720p-equivalent proportion for crisp 60fps interaction
      const { width: outW, height: outH } = getOutputDimensions(aspectRatio, '720p', sourceSize);
      if (canvas.width !== outW || canvas.height !== outH) {
        canvas.width = outW;
        canvas.height = outH;
      }

      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) return;

      let background: BackgroundDrawable = { kind: 'none' };
      if (media.backgroundType === 'image' && imageElementRef.current?.complete) {
        const img = imageElementRef.current;
        background = {
          kind: 'image',
          source: img,
          width: img.naturalWidth || media.backgroundWidth,
          height: img.naturalHeight || media.backgroundHeight,
        };
      } else if (
        media.backgroundType === 'video' &&
        videoElementRef.current &&
        videoElementRef.current.readyState >= 2
      ) {
        const vid = videoElementRef.current;
        background = {
          kind: 'video-element',
          source: vid,
          width: vid.videoWidth || media.backgroundWidth,
          height: vid.videoHeight || media.backgroundHeight,
        };
      }

      const fps = exportSettings.fps;
      const frameIndex = computedAnalysis
        ? Math.min(
            computedAnalysis.frames.length - 1,
            Math.max(0, Math.floor(timeSec * computedAnalysis.raw.fps)),
          )
        : 0;

      renderStudioFrame({
        ctx,
        width: outW,
        height: outH,
        frameIndex,
        analysis: computedAnalysis,
        background,
        imageFit: media.imageFit,
        bleedPercent: media.bleedPercent,
        bass: bassSettings,
        visualizer: visualizerSettings,
        gradient: gradientSettings,
      });

      // Compute instantaneous meter levels for left-panel telemetry
      if (computedAnalysis && computedAnalysis.frames.length > 0) {
        const bVal = computedAnalysis.frames[frameIndex]?.bass ?? 0;
        const mOffset = frameIndex * computedAnalysis.raw.melodicBinCount;
        let mSum = 0;
        for (let k = 0; k < computedAnalysis.raw.melodicBinCount; k++) {
          mSum += computedAnalysis.raw.melodicBins[mOffset + k] ?? 0;
        }
        const mVal = Math.min(1, (mSum / computedAnalysis.raw.melodicBinCount) * 1.6);
        return { bass: bVal, melodic: mVal, frameIndex, fps };
      }
      return { bass: 0, melodic: 0, frameIndex: 0, fps };
    },
    [
      aspectRatio,
      media.backgroundType,
      media.backgroundWidth,
      media.backgroundHeight,
      media.imageFit,
      media.bleedPercent,
      sourceSize,
      exportSettings.fps,
      computedAnalysis,
      bassSettings,
      visualizerSettings,
      gradientSettings,
    ],
  );

  // Paint preview whenever settings/media/analysis update while paused
  useEffect(() => {
    if (!isPlaying) {
      paintPreviewAtTime(currentTimeRef.current);
    }
  }, [isPlaying, paintPreviewAtTime]);

  // Decode and analyze an audio source file (either standalone audio or video's audio track)
  const loadAndAnalyzeAudioFromFile = useCallback(
    async (file: File, labelPrefix = '') => {
      stopAudioPlayback();
      currentTimeRef.current = 0;
      setCurrentTime(0);
      setRawSpectrum(null);
      setAudioBuffer(null);
      monoPcmRef.current = null;

      setAnalysisSummary({
        status: 'decoding',
        progress: 8,
        statusLabel: `${labelPrefix}กำลังถอดรหัสไฟล์เสียง...`,
        duration: 0,
        sampleRate: 44100,
        totalFrames: 0,
        estimatedBpm: 0,
        peakBassFrames: 0,
      });

      try {
        const decoded = await decodeMediaAudioBuffer(file);
        const mono = mixAudioBufferToMono(decoded);
        monoPcmRef.current = {
          pcm: mono,
          sampleRate: decoded.sampleRate,
          duration: decoded.duration,
        };
        setAudioBuffer(decoded);
        dispatchWorkerAnalysis(mono, decoded.sampleRate, decoded.duration, exportSettings.fps);
      } catch (err) {
        setAnalysisSummary({
          status: 'error',
          progress: 0,
          statusLabel: 'ไม่สามารถถอดรหัสไฟล์เสียงได้',
          errorMessage: err instanceof Error ? err.message : 'ไม่รองรับรูปแบบไฟล์นี้',
          duration: 0,
          sampleRate: 44100,
          totalFrames: 0,
          estimatedBpm: 0,
          peakBassFrames: 0,
        });
      }
    },
    [stopAudioPlayback, dispatchWorkerAnalysis, exportSettings.fps],
  );

  // Handle background Image or Video file selection
  const handleSelectBackgroundFile = useCallback(
    async (file: File) => {
      const lower = file.name.toLowerCase();
      const isVideo =
        file.type.startsWith('video/') || /\.(mp4|webm|mov|m4v|mkv)$/.test(lower);
      const isImage =
        file.type.startsWith('image/') || /\.(png|jpe?g|webp|bmp)$/.test(lower);

      if (!isVideo && !isImage) {
        setAnalysisSummary((prev) => ({
          ...prev,
          status: prev.status === 'idle' ? 'error' : prev.status,
          errorMessage: 'รองรับเฉพาะไฟล์ภาพ (.png, .jpg, .webp) หรือวิดีโอ (.mp4, .webm, .mov)',
        }));
        return;
      }

      // Clean old object URLs
      if (activeImageUrlRef.current) {
        URL.revokeObjectURL(activeImageUrlRef.current);
        activeImageUrlRef.current = null;
      }
      if (activeVideoUrlRef.current) {
        URL.revokeObjectURL(activeVideoUrlRef.current);
        activeVideoUrlRef.current = null;
      }
      imageElementRef.current = null;
      if (videoElementRef.current) {
        videoElementRef.current.pause();
        videoElementRef.current.removeAttribute('src');
        videoElementRef.current.load();
      }

      if (isImage) {
        const url = URL.createObjectURL(file);
        activeImageUrlRef.current = url;
        const img = new Image();
        img.onload = () => {
          imageElementRef.current = img;
          setAspectRatio('source');
          setMedia((prev) => ({
            ...prev,
            backgroundType: 'image',
            backgroundFile: file,
            backgroundFileName: file.name,
            backgroundUrl: url,
            backgroundWidth: img.naturalWidth,
            backgroundHeight: img.naturalHeight,
            backgroundDuration: 0,
            videoHasAudio: false,
          }));
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
          activeImageUrlRef.current = null;
        };
        img.src = url;
      } else {
        const url = URL.createObjectURL(file);
        activeVideoUrlRef.current = url;
        let meta = { width: 1280, height: 720, duration: 0, hasAudio: false };
        try {
          meta = await probeVideoFileMetadata(file);
        } catch {
          // Fallback to HTMLVideoElement metadata if container probing hits an edge case
          meta = await new Promise((resolve) => {
            const probeVid = document.createElement('video');
            probeVid.preload = 'metadata';
            probeVid.muted = true;
            probeVid.onloadedmetadata = () => {
              resolve({
                width: probeVid.videoWidth || 1280,
                height: probeVid.videoHeight || 720,
                duration: Number.isFinite(probeVid.duration) ? probeVid.duration : 0,
                hasAudio: true,
              });
            };
            probeVid.onerror = () => {
              resolve({ width: 1280, height: 720, duration: 0, hasAudio: false });
            };
            probeVid.src = url;
          });
        }

        const vidEl = videoElementRef.current;
        if (vidEl) {
          vidEl.src = url;
          vidEl.currentTime = 0;
          vidEl.onloadeddata = () => {
            paintPreviewAtTime(currentTimeRef.current);
          };
        }

        const nextAudioMode: AudioSourceMode =
          media.customAudioFile !== null
            ? 'custom'
            : meta.hasAudio
              ? 'video'
              : 'custom';

        setAspectRatio('source');
        setMedia((prev) => ({
          ...prev,
          backgroundType: 'video',
          backgroundFile: file,
          backgroundFileName: file.name,
          backgroundUrl: url,
          backgroundWidth: meta.width,
          backgroundHeight: meta.height,
          backgroundDuration: meta.duration,
          videoHasAudio: meta.hasAudio,
          audioSourceMode: nextAudioMode,
        }));

        // Automatically extract and analyze audio from video if in video-audio mode
        if (meta.hasAudio && nextAudioMode === 'video') {
          await loadAndAnalyzeAudioFromFile(file, '[เสียงจากวิดีโอ] ');
        }
      }
    },
    [media.customAudioFile, loadAndAnalyzeAudioFromFile, paintPreviewAtTime],
  );

  // Handle standalone Audio file selection
  const handleSelectAudioFile = useCallback(
    async (file: File) => {
      setMedia((prev) => ({
        ...prev,
        customAudioFile: file,
        customAudioFileName: file.name,
        audioSourceMode: 'custom',
      }));
      await loadAndAnalyzeAudioFromFile(file);
    },
    [loadAndAnalyzeAudioFromFile],
  );

  const handleClearBackground = useCallback(() => {
    if (activeImageUrlRef.current) {
      URL.revokeObjectURL(activeImageUrlRef.current);
      activeImageUrlRef.current = null;
    }
    if (activeVideoUrlRef.current) {
      URL.revokeObjectURL(activeVideoUrlRef.current);
      activeVideoUrlRef.current = null;
    }
    imageElementRef.current = null;
    if (videoElementRef.current) {
      videoElementRef.current.pause();
      videoElementRef.current.removeAttribute('src');
      videoElementRef.current.load();
    }

    const wasUsingVideoAudio =
      media.backgroundType === 'video' && media.audioSourceMode === 'video';
    setMedia((prev) => ({
      ...prev,
      backgroundType: 'none',
      backgroundFile: null,
      backgroundFileName: '',
      backgroundUrl: null,
      backgroundWidth: 0,
      backgroundHeight: 0,
      backgroundDuration: 0,
      videoHasAudio: false,
      audioSourceMode: prev.customAudioFile ? 'custom' : 'video',
    }));

    if (wasUsingVideoAudio && !media.customAudioFile) {
      stopAudioPlayback();
      setAudioBuffer(null);
      setRawSpectrum(null);
      monoPcmRef.current = null;
      setAnalysisSummary(INITIAL_SUMMARY);
    }
  }, [media.backgroundType, media.audioSourceMode, media.customAudioFile, stopAudioPlayback]);

  const handleClearAudio = useCallback(async () => {
    const canFallbackToVideo =
      media.backgroundType === 'video' && media.videoHasAudio && media.backgroundFile !== null;

    setMedia((prev) => ({
      ...prev,
      customAudioFile: null,
      customAudioFileName: '',
      audioSourceMode: canFallbackToVideo ? 'video' : 'custom',
    }));

    if (canFallbackToVideo && media.backgroundFile) {
      await loadAndAnalyzeAudioFromFile(media.backgroundFile, '[เสียงจากวิดีโอ] ');
    } else {
      stopAudioPlayback();
      setAudioBuffer(null);
      setRawSpectrum(null);
      monoPcmRef.current = null;
      setAnalysisSummary(INITIAL_SUMMARY);
      currentTimeRef.current = 0;
      setCurrentTime(0);
    }
  }, [
    media.backgroundType,
    media.videoHasAudio,
    media.backgroundFile,
    loadAndAnalyzeAudioFromFile,
    stopAudioPlayback,
  ]);

  const handleChangeAudioSourceMode = useCallback(
    async (mode: AudioSourceMode) => {
      if (mode === media.audioSourceMode) return;
      setMedia((prev) => ({ ...prev, audioSourceMode: mode }));
      if (mode === 'video' && media.backgroundType === 'video' && media.backgroundFile) {
        await loadAndAnalyzeAudioFromFile(media.backgroundFile, '[เสียงจากวิดีโอ] ');
      } else if (mode === 'custom' && media.customAudioFile) {
        await loadAndAnalyzeAudioFromFile(media.customAudioFile);
      }
    },
    [
      media.audioSourceMode,
      media.backgroundType,
      media.backgroundFile,
      media.customAudioFile,
      loadAndAnalyzeAudioFromFile,
    ],
  );

  // One-click Demo loader
  const handleLoadDemo = useCallback(async () => {
    setIsDemoLoading(true);
    try {
      const { imageFile, audioFile } = await createDemoProjectAssets();
      await handleSelectBackgroundFile(imageFile);
      await handleSelectAudioFile(audioFile);
    } finally {
      setIsDemoLoading(false);
    }
  }, [handleSelectBackgroundFile, handleSelectAudioFile]);

  // Volume updates on live GainNode
  useEffect(() => {
    if (gainNodeRef.current && audioCtxRef.current) {
      const targetGain = isMuted ? 0 : volume / 100;
      gainNodeRef.current.gain.setTargetAtTime(targetGain, audioCtxRef.current.currentTime, 0.015);
    }
  }, [volume, isMuted]);

  // Real-time synchronized playback loop
  const startPlaybackFrom = useCallback(
    async (startSec: number) => {
      if (!audioBuffer || !computedAnalysis) return;
      stopAudioPlayback();

      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioCtx();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      const gainNode = ctx.createGain();
      gainNode.gain.value = isMuted ? 0 : volume / 100;
      gainNode.connect(ctx.destination);
      gainNodeRef.current = gainNode;

      const safeOffset = Math.min(Math.max(0, startSec), Math.max(0, audioBuffer.duration - 0.02));
      const src = ctx.createBufferSource();
      src.buffer = audioBuffer;
      src.connect(gainNode);
      src.start(0, safeOffset);

      audioSourceRef.current = src;
      playStartCtxTimeRef.current = ctx.currentTime;
      playStartOffsetRef.current = safeOffset;
      isPlayingRef.current = true;
      setIsPlaying(true);

      // Sync video element if present
      const vid = videoElementRef.current;
      if (media.backgroundType === 'video' && vid) {
        const vidDur = media.backgroundDuration || vid.duration || 0;
        if (vidDur > 0) {
          const targetVidT = media.loopVideo
            ? safeOffset % vidDur
            : Math.min(vidDur - 0.02, safeOffset);
          vid.currentTime = targetVidT;
          if (media.loopVideo || safeOffset < vidDur - 0.02) {
            void vid.play().catch(() => {});
          }
        }
      }

      const tick = (nowMs: number) => {
        if (!isPlayingRef.current || !audioCtxRef.current) return;
        const t =
          playStartOffsetRef.current +
          (audioCtxRef.current.currentTime - playStartCtxTimeRef.current);

        if (t >= audioBuffer.duration) {
          stopAudioPlayback();
          currentTimeRef.current = 0;
          setCurrentTime(0);
          setLiveBassMeter(0);
          setLiveMelodicMeter(0);
          paintPreviewAtTime(0);
          return;
        }

        currentTimeRef.current = t;

        // Keep video background synced across loops or freeze after end
        const vidEl = videoElementRef.current;
        if (media.backgroundType === 'video' && vidEl) {
          const vidDur = media.backgroundDuration || vidEl.duration || 0;
          if (vidDur > 0) {
            if (!media.loopVideo && t >= vidDur - 0.02) {
              if (!vidEl.paused) vidEl.pause();
            } else {
              const targetVidT = media.loopVideo ? t % vidDur : t;
              if (vidEl.paused) void vidEl.play().catch(() => {});
              if (Math.abs(vidEl.currentTime - targetVidT) > 0.16) {
                vidEl.currentTime = targetVidT;
              }
            }
          }
        }

        const telemetry = paintPreviewAtTime(t);
        // Throttle React UI scrubber/meter updates slightly (~30 Hz) while canvas runs full 60 Hz
        if (nowMs - lastUiSyncMsRef.current > 32) {
          lastUiSyncMsRef.current = nowMs;
          setCurrentTime(t);
          if (telemetry) {
            setLiveBassMeter(telemetry.bass);
            setLiveMelodicMeter(telemetry.melodic);
          }
        }

        rafIdRef.current = requestAnimationFrame(tick);
      };

      rafIdRef.current = requestAnimationFrame(tick);
    },
    [
      audioBuffer,
      computedAnalysis,
      stopAudioPlayback,
      isMuted,
      volume,
      media.backgroundType,
      media.backgroundDuration,
      media.loopVideo,
      paintPreviewAtTime,
    ],
  );

  const handleTogglePlay = useCallback(() => {
    if (isPlayingRef.current) {
      stopAudioPlayback();
      setCurrentTime(currentTimeRef.current);
      paintPreviewAtTime(currentTimeRef.current);
    } else {
      const startAt =
        audioBuffer && currentTimeRef.current >= audioBuffer.duration - 0.05
          ? 0
          : currentTimeRef.current;
      void startPlaybackFrom(startAt);
    }
  }, [audioBuffer, startPlaybackFrom, stopAudioPlayback, paintPreviewAtTime]);

  const handleSeek = useCallback(
    (targetSec: number) => {
      const clamped = Math.max(0, Math.min(targetSec, audioBuffer?.duration ?? 0));
      currentTimeRef.current = clamped;
      setCurrentTime(clamped);

      if (media.backgroundType === 'video' && videoElementRef.current) {
        const vid = videoElementRef.current;
        const vidDur = media.backgroundDuration || vid.duration || 0;
        if (vidDur > 0) {
          vid.currentTime = media.loopVideo ? clamped % vidDur : Math.min(vidDur - 0.02, clamped);
        }
      }

      if (isPlayingRef.current) {
        void startPlaybackFrom(clamped);
      } else {
        const telemetry = paintPreviewAtTime(clamped);
        if (telemetry) {
          setLiveBassMeter(telemetry.bass);
          setLiveMelodicMeter(telemetry.melodic);
        }
      }
    },
    [
      audioBuffer,
      media.backgroundType,
      media.backgroundDuration,
      media.loopVideo,
      startPlaybackFrom,
      paintPreviewAtTime,
    ],
  );

  // Offline MP4 Export Trigger
  const handleStartExport = useCallback(async () => {
    if (!audioBuffer || !computedAnalysis) return;
    stopAudioPlayback();

    // Clean any previous exported blob URL
    if (exportState.outputBlobUrl) {
      URL.revokeObjectURL(exportState.outputBlobUrl);
    }

    const controller = new AbortController();
    exportAbortRef.current = controller;

    setExportState({
      isOpen: true,
      status: 'preparing',
      progress: 0,
      currentFrame: 0,
      totalFrames: computedAnalysis.raw.totalFrames,
      elapsedSeconds: 0,
      etaSeconds: 0,
      message: 'กำลังเตรียมตัวเข้ารหัส WebCodecs...',
    });

    try {
      const result = await exportStudioMp4({
        aspectRatio,
        exportSettings,
        media,
        audioBuffer,
        analysis: computedAnalysis,
        bass: bassSettings,
        visualizer: visualizerSettings,
        gradient: gradientSettings,
        signal: controller.signal,
        onProgress: (info) => {
          setExportState((prev) => ({
            ...prev,
            isOpen: true,
            status: info.status,
            progress: info.progress,
            currentFrame: info.currentFrame,
            totalFrames: info.totalFrames,
            elapsedSeconds: info.elapsedSeconds,
            etaSeconds: info.etaSeconds,
            message: info.message,
          }));
        },
      });

      const blobUrl = URL.createObjectURL(result.blob);
      setExportState((prev) => ({
        ...prev,
        isOpen: true,
        status: 'completed',
        progress: 100,
        currentFrame: result.totalFrames,
        totalFrames: result.totalFrames,
        outputBlobUrl: blobUrl,
        outputFileName: result.fileName,
        outputSizeBytes: result.blob.size,
        message: 'ส่งออก MP4 สำเร็จ',
      }));
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setExportState((prev) => ({
          ...prev,
          isOpen: true,
          status: 'cancelled',
          message: 'ยกเลิกการเรนเดอร์',
        }));
      } else {
        setExportState((prev) => ({
          ...prev,
          isOpen: true,
          status: 'error',
          errorMessage: err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการส่งออก MP4',
        }));
      }
    } finally {
      exportAbortRef.current = null;
    }
  }, [
    audioBuffer,
    computedAnalysis,
    stopAudioPlayback,
    exportState.outputBlobUrl,
    aspectRatio,
    exportSettings,
    media,
    bassSettings,
    visualizerSettings,
    gradientSettings,
  ]);

  const handleCancelExport = useCallback(() => {
    exportAbortRef.current?.abort();
  }, []);

  const handleCloseExportModal = useCallback(() => {
    setExportState((prev) => ({ ...prev, isOpen: false }));
  }, []);

  // Cleanup URLs and AudioContext on unmount
  useEffect(() => {
    return () => {
      stopAudioPlayback();
      if (activeImageUrlRef.current) URL.revokeObjectURL(activeImageUrlRef.current);
      if (activeVideoUrlRef.current) URL.revokeObjectURL(activeVideoUrlRef.current);
      if (audioCtxRef.current) {
        void audioCtxRef.current.close().catch(() => {});
      }
    };
  }, [stopAudioPlayback]);

  const canExport =
    analysisSummary.status === 'ready' && audioBuffer !== null && computedAnalysis !== null;
  const isExporting =
    exportState.isOpen &&
    (exportState.status === 'preparing' ||
      exportState.status === 'rendering' ||
      exportState.status === 'muxing');

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#0B0D12] text-slate-100 flex flex-col">
      {/* Hidden video element used exclusively for live preview texture sampling */}
      <video
        ref={videoElementRef}
        muted
        playsInline
        preload="auto"
        className="hidden"
        onSeeked={() => {
          if (!isPlayingRef.current) {
            paintPreviewAtTime(currentTimeRef.current);
          }
        }}
      />

      <HeaderBar
        aspectRatio={aspectRatio}
        sourceSize={sourceSize}
        onChangeAspectRatio={setAspectRatio}
        canExport={canExport}
        isExporting={isExporting}
        capability={capability}
        onOpenExport={() => {
          setActiveTab('export');
          void handleStartExport();
        }}
      />

      <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden">
        <MediaPanel
          media={media}
          analysisSummary={analysisSummary}
          liveBassMeter={liveBassMeter}
          liveMelodicMeter={liveMelodicMeter}
          isDemoLoading={isDemoLoading}
          onSelectBackgroundFile={(file) => void handleSelectBackgroundFile(file)}
          onClearBackground={handleClearBackground}
          onSelectAudioFile={(file) => void handleSelectAudioFile(file)}
          onClearAudio={() => void handleClearAudio()}
          onChangeImageFit={(fit: ImageFitMode) =>
            setMedia((prev) => ({ ...prev, imageFit: fit }))
          }
          onChangeBleed={(bleed) =>
            setMedia((prev) => ({ ...prev, bleedPercent: bleed }))
          }
          onChangeLoopVideo={(loop) =>
            setMedia((prev) => ({ ...prev, loopVideo: loop }))
          }
          onChangeAudioSourceMode={(mode) => void handleChangeAudioSourceMode(mode)}
          onLoadDemo={() => void handleLoadDemo()}
        />

        <PreviewStage
          canvasRef={previewCanvasRef}
          aspectRatio={aspectRatio}
          sourceSize={sourceSize}
          exportSettings={exportSettings}
          visualizer={visualizerSettings}
          gradient={gradientSettings}
          analysis={computedAnalysis}
          currentTime={currentTime}
          duration={audioBuffer?.duration ?? 0}
          isPlaying={isPlaying}
          volume={volume}
          isMuted={isMuted}
          onTogglePlay={handleTogglePlay}
          onSeek={handleSeek}
          onChangeVolume={(v) => {
            setVolume(v);
            if (v > 0 && isMuted) setIsMuted(false);
          }}
          onToggleMute={() => setIsMuted((m) => !m)}
        />

        <InspectorPanel
          activeTab={activeTab}
          onChangeTab={setActiveTab}
          aspectRatio={aspectRatio}
          sourceSize={sourceSize}
          bass={bassSettings}
          onChangeBass={setBassSettings}
          visualizer={visualizerSettings}
          onChangeVisualizer={setVisualizerSettings}
          gradient={gradientSettings}
          onChangeGradient={setGradientSettings}
          exportSettings={exportSettings}
          onChangeExport={setExportSettings}
          duration={audioBuffer?.duration ?? 0}
          canExport={canExport}
          isExporting={isExporting}
          capability={capability}
          onStartExport={() => void handleStartExport()}
        />
      </div>

      <ExportModal
        state={exportState}
        onCancel={handleCancelExport}
        onClose={handleCloseExportModal}
      />
    </div>
  );
}

export default App;
