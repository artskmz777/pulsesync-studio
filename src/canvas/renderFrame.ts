import { getGradientById } from '../constants/gradients';
import type {
  BassSettings,
  ComputedAnalysis,
  GradientDirection,
  GradientSettings,
  ImageFitMode,
  TriColorGradient,
  VisualizerSettings,
} from '../types/studio';

export type BackgroundDrawable =
  | { kind: 'none' }
  | { kind: 'image'; source: CanvasImageSource; width: number; height: number }
  | { kind: 'video-element'; source: HTMLVideoElement; width: number; height: number }
  | { kind: 'custom'; draw: (ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, dx: number, dy: number, dw: number, dh: number) => void; width: number; height: number };

export interface RenderFrameParams {
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  width: number;
  height: number;
  frameIndex: number;
  analysis: ComputedAnalysis | null;
  background: BackgroundDrawable;
  imageFit: ImageFitMode;
  bleedPercent: number;
  bass: BassSettings;
  visualizer: VisualizerSettings;
  gradient: GradientSettings;
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

function createTriColorGradient(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  palette: TriColorGradient,
  direction: GradientDirection,
): CanvasGradient {
  let grad: CanvasGradient;
  if (direction === 'vertical') {
    grad = ctx.createLinearGradient(x, y + h, x, y);
  } else if (direction === 'diagonal') {
    grad = ctx.createLinearGradient(x, y + h, x + w, y);
  } else {
    grad = ctx.createLinearGradient(x, y, x + w, y);
  }
  grad.addColorStop(0, palette.colors[0]);
  grad.addColorStop(0.5, palette.colors[1]);
  grad.addColorStop(1, palette.colors[2]);
  return grad;
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const r = Number.parseInt(clean.slice(0, 2), 16);
  const g = Number.parseInt(clean.slice(2, 4), 16);
  const b = Number.parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${clamp(alpha, 0, 1).toFixed(3)})`;
}

function sampleMelodicFrame(
  analysis: ComputedAnalysis,
  frameIdx: number,
  sensitivityPercent: number,
): Float32Array {
  const { melodicBins, melodicBinCount, totalFrames } = analysis.raw;
  const clampedIdx = clamp(frameIdx, 0, totalFrames - 1);
  const offset = clampedIdx * melodicBinCount;
  const gain = sensitivityPercent / 100;
  const out = new Float32Array(melodicBinCount);
  for (let i = 0; i < melodicBinCount; i++) {
    const rawVal = melodicBins[offset + i]! * gain;
    // Soft knee near 1.0 so loud choruses preserve dynamic shape
    out[i] = rawVal <= 0.85 ? clamp(rawVal, 0, 1) : clamp(0.85 + 0.15 * Math.tanh((rawVal - 0.85) / 0.35), 0, 1);
  }
  return out;
}

function interpolateBins(bins: Float32Array, count: number): Float32Array {
  const out = new Float32Array(count);
  const srcLen = bins.length;
  for (let i = 0; i < count; i++) {
    const pos = (i / Math.max(1, count - 1)) * (srcLen - 1);
    const lo = Math.floor(pos);
    const hi = Math.min(srcLen - 1, lo + 1);
    const frac = pos - lo;
    out[i] = bins[lo]! * (1 - frac) + bins[hi]! * frac;
  }
  return out;
}

function computePeakCaps(
  analysis: ComputedAnalysis,
  frameIdx: number,
  count: number,
  sensitivityPercent: number,
): Float32Array {
  const { fps, melodicBins, melodicBinCount, totalFrames } = analysis.raw;
  const lookback = Math.min(36, Math.max(8, Math.round(fps * 0.45)));
  const gain = sensitivityPercent / 100;
  const peaksRaw = new Float32Array(melodicBinCount);

  for (let j = 0; j < lookback; j++) {
    const f = frameIdx - j;
    if (f < 0) break;
    const clampedF = Math.min(totalFrames - 1, f);
    const base = clampedF * melodicBinCount;
    const drop = (j / lookback) * 0.34;
    for (let k = 0; k < melodicBinCount; k++) {
      const val = clamp(melodicBins[base + k]! * gain - drop, 0, 1);
      if (val > peaksRaw[k]!) {
        peaksRaw[k] = val;
      }
    }
  }

  return interpolateBins(peaksRaw, count);
}

function drawSmoothCurve(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  points: readonly { x: number; y: number }[],
): void {
  if (points.length === 0) return;
  if (points.length === 1) {
    ctx.moveTo(points[0]!.x, points[0]!.y);
    return;
  }
  ctx.moveTo(points[0]!.x, points[0]!.y);
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = points[Math.min(points.length - 1, i + 2)]!;

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
  }
}

export function renderStudioFrame(params: RenderFrameParams): void {
  const {
    ctx,
    width,
    height,
    frameIndex,
    analysis,
    background,
    imageFit,
    bleedPercent,
    bass,
    visualizer,
    gradient,
  } = params;

  const palette = getGradientById(gradient.gradientId);

  // 1. Clear obsidian studio backdrop
  ctx.save();
  ctx.fillStyle = '#07090E';
  ctx.fillRect(0, 0, width, height);

  // 2. Compute bass reactivity transform for frameIndex
  const frameInfo =
    analysis && analysis.frames.length > 0
      ? analysis.frames[clamp(frameIndex, 0, analysis.frames.length - 1)]!
      : { bass: 0, bassImpact: 0, shakeX: 0, shakeY: 0 };

  const bassLevel = bass.enabled ? frameInfo.bass : 0;
  const bassZoomRatio = bass.enabled ? (bass.intensity / 100) * 0.12 * bassLevel : 0;
  const maxShakePx = Math.min(width, height) * 0.022;
  const bleedSafeMax = (bleedPercent / 100) * 0.42 * Math.min(width, height);
  const shakeMagnitude = bass.enabled
    ? Math.min(bleedSafeMax, (bass.microShake / 100) * maxShakePx)
    : 0;
  const offsetX = frameInfo.shakeX * shakeMagnitude;
  const offsetY = frameInfo.shakeY * shakeMagnitude;
  const bassGlowAmount = bass.enabled ? (bass.bassGlow / 100) * bassLevel : 0;

  // 3. Draw Background Image or Video Frame with Bleed Margin + Bass Zoom/Shake
  if (background.kind === 'none') {
    drawPlaceholderBackdrop(ctx, width, height, palette, bassZoomRatio);
  } else if (background.width > 0 && background.height > 0) {
    const srcW = background.width;
    const srcH = background.height;
    const isCover = background.kind !== 'image' || imageFit === 'cover';
    const baseScale = isCover
      ? Math.max(width / srcW, height / srcH)
      : Math.min(width / srcW, height / srcH);
    const bleedScale = isCover ? 1 + bleedPercent / 100 : 1;
    const totalScale = baseScale * bleedScale * (1 + bassZoomRatio);

    const drawW = srcW * totalScale;
    const drawH = srcH * totalScale;
    const drawX = (width - drawW) * 0.5 + offsetX;
    const drawY = (height - drawH) * 0.5 + offsetY;

    // In Contain mode, draw a subtle ambient blurred fill behind the contained frame
    if (!isCover) {
      const fillScale = Math.max(width / srcW, height / srcH) * (1 + bleedPercent / 100);
      const fw = srcW * fillScale;
      const fh = srcH * fillScale;
      ctx.save();
      ctx.globalAlpha = 0.24;
      drawBackgroundItem(ctx, background, (width - fw) * 0.5, (height - fh) * 0.5, fw, fh);
      ctx.fillStyle = 'rgba(7, 9, 14, 0.65)';
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    }

    drawBackgroundItem(ctx, background, drawX, drawY, drawW, drawH);
  }

  // 4. Bass Glow Pulse (linear stage illumination wash — zero circular overlays)
  if (bassGlowAmount > 0.005) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const whiteFlash = clamp(bassGlowAmount * 0.16, 0, 0.22);
    ctx.fillStyle = `rgba(255, 255, 255, ${whiteFlash.toFixed(3)})`;
    ctx.fillRect(0, 0, width, height);

    const stageWash = ctx.createLinearGradient(0, height, 0, 0);
    stageWash.addColorStop(0, hexToRgba(palette.colors[0], bassGlowAmount * 0.22));
    stageWash.addColorStop(0.5, hexToRgba(palette.colors[1], bassGlowAmount * 0.08));
    stageWash.addColorStop(1, hexToRgba(palette.colors[2], bassGlowAmount * 0.16));
    ctx.fillStyle = stageWash;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }

  // Subtle top/bottom studio contrast scrim so melodic waves always pop legibly
  ctx.save();
  const scrim = ctx.createLinearGradient(0, 0, 0, height);
  scrim.addColorStop(0, 'rgba(7, 9, 14, 0.22)');
  scrim.addColorStop(0.5, 'rgba(7, 9, 14, 0.04)');
  scrim.addColorStop(1, 'rgba(7, 9, 14, 0.36)');
  ctx.fillStyle = scrim;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();

  // 5. Render Melodic Visualizer (strictly 160 - 16,000 Hz, strictly non-circular)
  if (visualizer.enabled) {
    renderMelodicVisualizer({
      ctx,
      width,
      height,
      frameIndex,
      analysis,
      visualizer,
      palette,
      direction: gradient.direction,
    });
  }

  ctx.restore();
}

function drawBackgroundItem(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  background: Exclude<BackgroundDrawable, { kind: 'none' }>,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
): void {
  if (background.kind === 'custom') {
    background.draw(ctx, dx, dy, dw, dh);
  } else {
    ctx.drawImage(background.source, dx, dy, dw, dh);
  }
}

function drawPlaceholderBackdrop(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  width: number,
  height: number,
  palette: TriColorGradient,
  bassZoomRatio: number,
): void {
  ctx.save();
  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, '#090C14');
  bg.addColorStop(0.55, '#101526');
  bg.addColorStop(1, '#141127');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  // Subtle ambient rectangular accent wash
  const accent = ctx.createLinearGradient(0, height * 0.6, width, height * 0.2);
  accent.addColorStop(0, hexToRgba(palette.colors[0], 0.08 + bassZoomRatio * 0.8));
  accent.addColorStop(0.5, hexToRgba(palette.colors[1], 0.09 + bassZoomRatio * 0.8));
  accent.addColorStop(1, hexToRgba(palette.colors[2], 0.08 + bassZoomRatio * 0.8));
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, width, height);

  // Crisp studio alignment grid
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.06)';
  ctx.lineWidth = Math.max(1, width * 0.001);
  const step = Math.round(Math.min(width, height) / 10);
  ctx.beginPath();
  for (let x = step; x < width; x += step) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
  }
  for (let y = step; y < height; y += step) {
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
  }
  ctx.stroke();
  ctx.restore();
}

interface VisualizerRenderArgs {
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  width: number;
  height: number;
  frameIndex: number;
  analysis: ComputedAnalysis | null;
  visualizer: VisualizerSettings;
  palette: TriColorGradient;
  direction: GradientDirection;
}

function getPreviewFallbackBins(count: number): Float32Array {
  const out = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const t = i / Math.max(1, count - 1);
    out[i] = 0.12 + 0.1 * Math.sin(t * Math.PI * 3) ** 2;
  }
  return out;
}

function renderMelodicVisualizer(args: VisualizerRenderArgs): void {
  const { ctx, width, height, frameIndex, analysis, visualizer, palette, direction } = args;

  const boxW = width * (visualizer.widthPercent / 100);
  const boxH = height * (visualizer.heightPercent / 100);
  const boxX = (width - boxW) * 0.5;
  const centerY = height * (visualizer.positionY / 100);
  const boxY = clamp(centerY - boxH * 0.5, height * 0.03, height * 0.97 - boxH);
  const baseY = boxY + boxH;
  const midY = boxY + boxH * 0.5;

  const unitScale = Math.min(width, height) / 1080;
  const thicknessFactor = visualizer.thickness;
  const grad = createTriColorGradient(ctx, boxX, boxY, boxW, boxH, palette, direction);

  const rawBins = analysis
    ? sampleMelodicFrame(analysis, frameIndex, visualizer.sensitivity)
    : getPreviewFallbackBins(64);

  ctx.save();
  ctx.globalAlpha = clamp(visualizer.opacity / 100, 0.05, 1);
  if (visualizer.glowBlur > 0) {
    ctx.shadowColor = hexToRgba(palette.colors[1], 0.72);
    ctx.shadowBlur = visualizer.glowBlur * unitScale;
  }
  ctx.fillStyle = grad;
  ctx.strokeStyle = grad;

  switch (visualizer.styleId) {
    case 'classic-bars': {
      const count = 48;
      const bins = interpolateBins(rawBins, count);
      const peaks = analysis
        ? computePeakCaps(analysis, frameIndex, count, visualizer.sensitivity)
        : bins;
      const slotW = boxW / count;
      const fillRatio = clamp(0.45 + thicknessFactor * 0.04, 0.38, 0.86);
      const barW = Math.max(2 * unitScale, slotW * fillRatio);
      const barOffset = (slotW - barW) * 0.5;
      const radius = Math.min(barW * 0.42, 6 * unitScale);

      for (let i = 0; i < count; i++) {
        const amp = Math.max(0.03, bins[i]!);
        const h = amp * boxH;
        const x = boxX + i * slotW + barOffset;
        const y = baseY - h;

        ctx.beginPath();
        ctx.roundRect(x, y, barW, h, [radius, radius, 0, 0]);
        ctx.fill();

        const peakY = baseY - Math.max(amp, peaks[i]!) * boxH - 4 * unitScale;
        ctx.fillRect(x, Math.max(boxY, peakY), barW, Math.max(2, 3 * unitScale));
      }
      break;
    }

    case 'mirrored-bars': {
      const count = 52;
      const bins = interpolateBins(rawBins, count);
      const slotW = boxW / count;
      const fillRatio = clamp(0.45 + thicknessFactor * 0.04, 0.35, 0.85);
      const barW = Math.max(2 * unitScale, slotW * fillRatio);
      const barOffset = (slotW - barW) * 0.5;
      const radius = Math.min(barW * 0.5, 8 * unitScale);

      // Subtle center horizon guide
      ctx.save();
      ctx.globalAlpha *= 0.35;
      ctx.fillRect(boxX, midY - 1 * unitScale, boxW, 2 * unitScale);
      ctx.restore();

      for (let i = 0; i < count; i++) {
        const halfH = Math.max(3 * unitScale, bins[i]! * boxH * 0.5);
        const x = boxX + i * slotW + barOffset;
        ctx.beginPath();
        ctx.roundRect(x, midY - halfH, barW, halfH * 2, radius);
        ctx.fill();
      }
      break;
    }

    case 'bezier-wave': {
      const count = 48;
      const bins = interpolateBins(rawBins, count);
      const pts: { x: number; y: number }[] = [];
      for (let i = 0; i < count; i++) {
        const x = boxX + (i / (count - 1)) * boxW;
        // Oscillate crest smoothly around center axis for lively melodic contour
        const waveSign = i % 2 === 0 ? 1 : -0.78;
        const y = midY - bins[i]! * boxH * 0.48 * waveSign;
        pts.push({ x, y });
      }
      ctx.lineWidth = Math.max(1.5, thicknessFactor * 0.85 * unitScale);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      drawSmoothCurve(ctx, pts);
      ctx.stroke();
      break;
    }

    case 'silk-ribbons': {
      const layers = [
        { lag: 0, alpha: 0.95, yShift: 0, scale: 1.0 },
        { lag: 3, alpha: 0.62, yShift: -0.05, scale: 0.9 },
        { lag: 6, alpha: 0.42, yShift: 0.05, scale: 0.82 },
        { lag: 9, alpha: 0.25, yShift: -0.09, scale: 0.74 },
      ];
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      for (let l = 0; l < layers.length; l++) {
        const layer = layers[l]!;
        const fIdx = Math.max(0, frameIndex - layer.lag);
        const layerBins = analysis
          ? sampleMelodicFrame(analysis, fIdx, visualizer.sensitivity)
          : rawBins;
        const pts: { x: number; y: number }[] = [];
        const count = 44;
        const sampled = interpolateBins(layerBins, count);
        for (let i = 0; i < count; i++) {
          const x = boxX + (i / (count - 1)) * boxW;
          const phaseMod = Math.sin(i * 0.45 + l * 0.95);
          const y =
            midY +
            layer.yShift * boxH -
            sampled[i]! * boxH * 0.44 * layer.scale * (0.45 + 0.55 * phaseMod);
          pts.push({ x, y });
        }
        ctx.save();
        ctx.globalAlpha *= layer.alpha;
        ctx.lineWidth = Math.max(1.5, (thicknessFactor * 0.75 - l * 0.4) * unitScale);
        ctx.beginPath();
        drawSmoothCurve(ctx, pts);
        ctx.stroke();
        ctx.restore();
      }
      break;
    }

    case 'mountain-fill': {
      const count = 48;
      const bins = interpolateBins(rawBins, count);
      const pts: { x: number; y: number }[] = [];
      for (let i = 0; i < count; i++) {
        const x = boxX + (i / (count - 1)) * boxW;
        const y = baseY - Math.max(0.02, bins[i]!) * boxH;
        pts.push({ x, y });
      }

      // Translucent area under mountain curve
      ctx.save();
      const areaGrad = ctx.createLinearGradient(0, boxY, 0, baseY);
      areaGrad.addColorStop(0, hexToRgba(palette.colors[1], 0.56));
      areaGrad.addColorStop(0.55, hexToRgba(palette.colors[0], 0.28));
      areaGrad.addColorStop(1, hexToRgba(palette.colors[2], 0.03));
      ctx.fillStyle = areaGrad;
      ctx.shadowBlur = 0;
      ctx.beginPath();
      drawSmoothCurve(ctx, pts);
      ctx.lineTo(boxX + boxW, baseY);
      ctx.lineTo(boxX, baseY);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // Bright ridge stroke
      ctx.lineWidth = Math.max(2, thicknessFactor * 0.7 * unitScale);
      ctx.lineCap = 'round';
      ctx.beginPath();
      drawSmoothCurve(ctx, pts);
      ctx.stroke();
      break;
    }

    case 'oscilloscope': {
      const oscCount = analysis ? analysis.raw.oscSampleCount : 96;
      const gain = visualizer.sensitivity / 100;
      const pts: { x: number; y: number }[] = [];

      // Reference zero line
      ctx.save();
      ctx.globalAlpha *= 0.22;
      ctx.lineWidth = Math.max(1, 1.2 * unitScale);
      ctx.beginPath();
      ctx.moveTo(boxX, midY);
      ctx.lineTo(boxX + boxW, midY);
      ctx.stroke();
      ctx.restore();

      if (analysis) {
        const clampedIdx = clamp(frameIndex, 0, analysis.raw.totalFrames - 1);
        const offset = clampedIdx * oscCount;
        for (let i = 0; i < oscCount; i++) {
          const sample = clamp(analysis.raw.oscilloscopeSlices[offset + i]! * gain, -1, 1);
          pts.push({
            x: boxX + (i / (oscCount - 1)) * boxW,
            y: midY - sample * boxH * 0.48,
          });
        }
      } else {
        for (let i = 0; i < oscCount; i++) {
          const t = i / (oscCount - 1);
          const s = Math.sin(t * Math.PI * 8) * 0.18 * Math.sin(t * Math.PI);
          pts.push({ x: boxX + t * boxW, y: midY - s * boxH * 0.48 });
        }
      }

      ctx.lineWidth = Math.max(1.8, thicknessFactor * 0.65 * unitScale);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      drawSmoothCurve(ctx, pts);
      ctx.stroke();
      break;
    }

    case 'led-matrix': {
      const cols = 32;
      const rows = 14;
      const bins = interpolateBins(rawBins, cols);
      const peaks = analysis
        ? computePeakCaps(analysis, frameIndex, cols, visualizer.sensitivity)
        : bins;
      const colW = boxW / cols;
      const blockW = Math.max(3 * unitScale, colW * 0.72);
      const colOffset = (colW - blockW) * 0.5;
      const rowH = boxH / rows;
      const blockH = Math.max(2 * unitScale, rowH * 0.68);
      const blockRadius = Math.min(2.5 * unitScale, blockH * 0.28);

      for (let c = 0; c < cols; c++) {
        const litRows = Math.max(1, Math.round(bins[c]! * rows));
        const peakRow = Math.min(rows - 1, Math.max(litRows - 1, Math.round(peaks[c]! * rows) - 1));
        const x = boxX + c * colW + colOffset;

        for (let r = 0; r < rows; r++) {
          const y = baseY - (r + 1) * rowH + (rowH - blockH) * 0.5;
          if (r < litRows) {
            ctx.beginPath();
            ctx.roundRect(x, y, blockW, blockH, blockRadius);
            ctx.fill();
          } else if (r === peakRow) {
            ctx.save();
            ctx.globalAlpha *= 0.85;
            ctx.beginPath();
            ctx.roundRect(x, y, blockW, blockH, blockRadius);
            ctx.fill();
            ctx.restore();
          } else {
            ctx.save();
            ctx.shadowBlur = 0;
            ctx.globalAlpha *= 0.1;
            ctx.fillStyle = '#94A3B8';
            ctx.beginPath();
            ctx.roundRect(x, y, blockW, blockH, blockRadius);
            ctx.fill();
            ctx.restore();
          }
        }
      }
      break;
    }

    case 'floating-pills': {
      const cols = 42;
      const bins = interpolateBins(rawBins, cols);
      const peaks = analysis
        ? computePeakCaps(analysis, frameIndex, cols, visualizer.sensitivity)
        : bins;
      const slotW = boxW / cols;
      const pillW = Math.max(3 * unitScale, slotW * clamp(0.42 + thicknessFactor * 0.04, 0.38, 0.78));
      const pillOffset = (slotW - pillW) * 0.5;
      const pillH = Math.max(6 * unitScale, pillW * 1.45);
      const radius = pillW * 0.5;

      for (let i = 0; i < cols; i++) {
        const x = boxX + i * slotW + pillOffset;
        const topAmp = Math.max(0.05, bins[i]!);
        const peakAmp = Math.max(topAmp, peaks[i]!);

        // Trailing pills underneath
        const trailLevels = [
          { amp: topAmp * 0.38, alpha: 0.26 },
          { amp: topAmp * 0.7, alpha: 0.52 },
          { amp: topAmp, alpha: 0.96 },
        ];
        for (const t of trailLevels) {
          const y = clamp(baseY - t.amp * (boxH - pillH) - pillH, boxY, baseY - pillH);
          ctx.save();
          ctx.globalAlpha *= t.alpha;
          ctx.beginPath();
          ctx.roundRect(x, y, pillW, pillH, radius);
          ctx.fill();
          ctx.restore();
        }

        // Peak indicator capsule
        const peakY = clamp(baseY - peakAmp * (boxH - pillH) - pillH, boxY, baseY - pillH);
        ctx.beginPath();
        ctx.roundRect(x, peakY, pillW, Math.max(3 * unitScale, pillH * 0.38), radius);
        ctx.fill();
      }
      break;
    }

    case 'dual-horizon': {
      const count = 56;
      const bins = interpolateBins(rawBins, count);
      const upperPts: { x: number; y: number }[] = [];
      const lowerPts: { x: number; y: number }[] = [];
      for (let i = 0; i < count; i++) {
        const x = boxX + (i / (count - 1)) * boxW;
        const amp = Math.max(0.02, bins[i]!);
        upperPts.push({ x, y: midY - amp * boxH * 0.48 });
        lowerPts.push({ x, y: midY + amp * boxH * 0.34 });
      }

      // Upper neon wave
      ctx.lineWidth = Math.max(2, thicknessFactor * 0.72 * unitScale);
      ctx.lineCap = 'round';
      ctx.beginPath();
      drawSmoothCurve(ctx, upperPts);
      ctx.stroke();

      // Horizon core divider
      ctx.save();
      ctx.globalAlpha *= 0.4;
      ctx.lineWidth = Math.max(1, 1.5 * unitScale);
      ctx.beginPath();
      ctx.moveTo(boxX, midY);
      ctx.lineTo(boxX + boxW, midY);
      ctx.stroke();
      ctx.restore();

      // Lower water reflection
      ctx.save();
      ctx.globalAlpha *= 0.45;
      ctx.lineWidth = Math.max(1.5, thicknessFactor * 0.55 * unitScale);
      ctx.beginPath();
      drawSmoothCurve(ctx, lowerPts);
      ctx.stroke();

      // Reflection shimmer scanlines
      ctx.shadowBlur = 0;
      ctx.globalAlpha *= 0.32;
      ctx.lineWidth = Math.max(1, unitScale);
      for (let i = 0; i < count; i += 2) {
        const y = midY + bins[i]! * boxH * 0.34;
        const x = boxX + (i / (count - 1)) * boxW;
        ctx.beginPath();
        ctx.moveTo(x - 6 * unitScale, y);
        ctx.lineTo(x + 6 * unitScale, y);
        ctx.stroke();
      }
      ctx.restore();
      break;
    }

    case 'dot-matrix': {
      const cols = 42;
      const rows = 9;
      const bins = interpolateBins(rawBins, cols);
      const slotW = boxW / cols;
      const rowH = boxH / rows;
      const dotSize = Math.max(2.5 * unitScale, Math.min(slotW, rowH) * clamp(0.32 + thicknessFactor * 0.03, 0.3, 0.62));
      const dotRadius = dotSize * 0.35;

      for (let c = 0; c < cols; c++) {
        const amp = bins[c]!;
        const x = boxX + c * slotW + (slotW - dotSize) * 0.5;
        const activeRows = Math.max(1, Math.round(amp * rows));

        for (let r = 0; r < rows; r++) {
          // Gentle wave lift along horizontal rows
          const waveLift = Math.sin(c * 0.28) * rowH * 0.18 * amp;
          const y = baseY - (r + 0.5) * rowH - dotSize * 0.5 - waveLift;
          const isLit = r < activeRows;
          ctx.save();
          ctx.globalAlpha *= isLit ? (0.45 + 0.55 * (r / Math.max(1, activeRows))) : 0.1;
          if (!isLit) ctx.shadowBlur = 0;
          ctx.beginPath();
          ctx.roundRect(x, clamp(y, boxY, baseY - dotSize), dotSize, dotSize, dotRadius);
          ctx.fill();
          ctx.restore();
        }
      }
      break;
    }

    case 'slanted-bars': {
      const count = 44;
      const bins = interpolateBins(rawBins, count);
      const slotW = boxW / count;
      const barW = Math.max(2.5 * unitScale, slotW * clamp(0.45 + thicknessFactor * 0.04, 0.38, 0.8));
      const skewX = Math.tan((15 * Math.PI) / 180); // Exactly 15 degrees slant

      for (let i = 0; i < count; i++) {
        const h = Math.max(4 * unitScale, bins[i]! * boxH);
        const x0 = boxX + i * slotW + (slotW - barW) * 0.5;
        const topShift = h * skewX;

        ctx.beginPath();
        ctx.moveTo(x0, baseY);
        ctx.lineTo(x0 + barW, baseY);
        ctx.lineTo(x0 + barW + topShift, baseY - h);
        ctx.lineTo(x0 + topShift, baseY - h);
        ctx.closePath();
        ctx.fill();
      }
      break;
    }

    case 'stereo-strips': {
      const strips = 26;
      const bins = interpolateBins(rawBins, strips);
      const centerX = boxX + boxW * 0.5;
      const halfMaxW = boxW * 0.48;
      const rowH = boxH / strips;
      const stripH = Math.max(2 * unitScale, rowH * clamp(0.45 + thicknessFactor * 0.04, 0.36, 0.78));
      const radius = stripH * 0.45;

      // Center vertical spine
      ctx.save();
      ctx.globalAlpha *= 0.45;
      ctx.fillRect(centerX - 1.5 * unitScale, boxY, 3 * unitScale, boxH);
      ctx.restore();

      for (let i = 0; i < strips; i++) {
        // Arrange low-mid near center and highs symmetrically toward top/bottom
        const distFromMid = Math.abs(i - (strips - 1) * 0.5) / (strips * 0.5);
        const binIdx = Math.min(strips - 1, Math.round(distFromMid * (strips - 1)));
        const w = Math.max(6 * unitScale, bins[binIdx]! * halfMaxW);
        const y = boxY + i * rowH + (rowH - stripH) * 0.5;
        const gap = 5 * unitScale;

        // Left strip
        ctx.beginPath();
        ctx.roundRect(centerX - gap - w, y, w, stripH, radius);
        ctx.fill();

        // Right strip
        ctx.beginPath();
        ctx.roundRect(centerX + gap, y, w, stripH, radius);
        ctx.fill();
      }
      break;
    }

    case 'particle-stream': {
      const particleCount = 128;
      const speedPhase = frameIndex * 0.012;
      for (let p = 0; p < particleCount; p++) {
        // Deterministic quasi-random seed per particle
        const seedA = (Math.sin(p * 12.9898) * 43758.5453) % 1;
        const seedB = (Math.sin(p * 78.233 + 1.3) * 24634.6345) % 1;
        const fracA = seedA < 0 ? seedA + 1 : seedA;
        const fracB = seedB < 0 ? seedB + 1 : seedB;

        const normX = (fracA + speedPhase * (0.4 + fracB * 0.7)) % 1;
        const binIdx = Math.min(rawBins.length - 1, Math.floor(normX * rawBins.length));
        const energy = rawBins[binIdx]!;

        const x = boxX + normX * boxW;
        const floatRipple = Math.sin(frameIndex * 0.08 + p * 0.7) * boxH * 0.06;
        const y = clamp(
          baseY - (0.08 + energy * 0.78 + fracB * 0.14) * boxH + floatRipple,
          boxY,
          baseY - 4 * unitScale,
        );
        const size = Math.max(2.2 * unitScale, (2.2 + energy * 4.5 + thicknessFactor * 0.35) * unitScale);

        ctx.save();
        ctx.globalAlpha *= 0.25 + energy * 0.75;
        // Crisp diamond/square light particle (strictly non-circular)
        ctx.translate(x, y);
        ctx.rotate(Math.PI * 0.25);
        ctx.fillRect(-size * 0.5, -size * 0.5, size, size);
        ctx.restore();
      }
      break;
    }

    case 'perspective-terrain': {
      const rows = 9;
      const cols = 42;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // Draw back-to-front so foreground ridges cleanly occlude background horizons
      for (let r = rows - 1; r >= 0; r--) {
        const depthT = r / (rows - 1); // 0 = front, 1 = back
        const lagFrames = r * 3;
        const fIdx = Math.max(0, frameIndex - lagFrames);
        const sliceRaw = analysis
          ? sampleMelodicFrame(analysis, fIdx, visualizer.sensitivity)
          : rawBins;
        const slice = interpolateBins(sliceRaw, cols);

        const rowScaleX = 1 - depthT * 0.34;
        const rowW = boxW * rowScaleX;
        const rowX = boxX + (boxW - rowW) * 0.5;
        const rowBaseY = baseY - depthT * boxH * 0.62;
        const rowAmpH = boxH * (0.36 - depthT * 0.14);

        const pts: { x: number; y: number }[] = [];
        for (let c = 0; c < cols; c++) {
          const x = rowX + (c / (cols - 1)) * rowW;
          const y = rowBaseY - slice[c]! * rowAmpH;
          pts.push({ x, y });
        }

        // Occluding valley fill
        ctx.save();
        ctx.shadowBlur = 0;
        ctx.fillStyle = `rgba(8, 11, 19, ${(0.82 - depthT * 0.25).toFixed(2)})`;
        ctx.beginPath();
        drawSmoothCurve(ctx, pts);
        ctx.lineTo(rowX + rowW, rowBaseY + 6 * unitScale);
        ctx.lineTo(rowX, rowBaseY + 6 * unitScale);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        // Glowing terrain ridge stroke
        ctx.save();
        ctx.globalAlpha *= 1 - depthT * 0.62;
        ctx.lineWidth = Math.max(1.2, (thicknessFactor * 0.5 - depthT * 1.2) * unitScale);
        ctx.beginPath();
        drawSmoothCurve(ctx, pts);
        ctx.stroke();
        ctx.restore();
      }
      break;
    }

    case 'hairline-spectrum': {
      const count = 96;
      const bins = interpolateBins(rawBins, count);
      const lineW = Math.max(1, (1 + thicknessFactor * 0.18) * unitScale);
      const slotW = boxW / count;

      ctx.lineWidth = lineW;
      ctx.lineCap = 'butt';
      ctx.beginPath();
      for (let i = 0; i < count; i++) {
        const x = boxX + (i + 0.5) * slotW;
        const h = Math.max(3 * unitScale, bins[i]! * boxH);
        ctx.moveTo(x, baseY);
        ctx.lineTo(x, baseY - h);
      }
      ctx.stroke();

      // Razor-fine cap ticks
      ctx.save();
      ctx.shadowBlur = 0;
      for (let i = 0; i < count; i++) {
        const x = boxX + (i + 0.5) * slotW - lineW;
        const y = baseY - Math.max(3 * unitScale, bins[i]! * boxH) - 3 * unitScale;
        ctx.fillRect(x, Math.max(boxY, y), lineW * 2, Math.max(1.5, lineW));
      }
      ctx.restore();
      break;
    }
  }

  ctx.restore();
}
