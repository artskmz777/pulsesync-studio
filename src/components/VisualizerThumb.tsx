import React from 'react';
import type { VisualizerStyleId } from '../types/studio';

interface VisualizerThumbProps {
  styleId: VisualizerStyleId;
  colors: readonly [string, string, string];
}

export const VisualizerThumb: React.FC<VisualizerThumbProps> = ({ styleId, colors }) => {
  const gradId = `thumb-${styleId}`;

  const renderShape = () => {
    switch (styleId) {
      case 'classic-bars':
        return (
          <g fill={`url(#${gradId})`}>
            {[8, 16, 24, 32, 40, 48, 56].map((x, idx) => {
              const h = [10, 18, 26, 20, 28, 16, 12][idx]!;
              return (
                <g key={x}>
                  <rect x={x} y={34 - h} width="4.5" height={h} rx="1.5" />
                  <rect x={x} y={31 - h} width="4.5" height="2" rx="1" />
                </g>
              );
            })}
          </g>
        );
      case 'mirrored-bars':
        return (
          <g fill={`url(#${gradId})`}>
            {[8, 16, 24, 32, 40, 48, 56].map((x, idx) => {
              const h = [8, 16, 24, 18, 26, 14, 10][idx]!;
              return <rect key={x} x={x} y={20 - h / 2} width="4.5" height={h} rx="2" />;
            })}
          </g>
        );
      case 'bezier-wave':
        return (
          <path
            d="M4 20 C 12 6, 18 32, 26 18 C 34 4, 42 34, 50 16 C 55 8, 60 22, 64 20"
            fill="none"
            stroke={`url(#${gradId})`}
            strokeWidth="2.6"
            strokeLinecap="round"
          />
        );
      case 'silk-ribbons':
        return (
          <g fill="none" stroke={`url(#${gradId})`} strokeLinecap="round">
            <path d="M4 22 Q 18 6, 34 22 T 64 18" strokeWidth="2.2" />
            <path d="M4 24 Q 20 12, 36 24 T 64 22" strokeWidth="1.6" opacity="0.65" />
            <path d="M4 27 Q 22 17, 38 26 T 64 25" strokeWidth="1.2" opacity="0.38" />
          </g>
        );
      case 'mountain-fill':
        return (
          <g>
            <path
              d="M4 34 L14 22 L24 14 L34 23 L44 10 L54 20 L64 34 Z"
              fill={`url(#${gradId})`}
              opacity="0.45"
            />
            <path
              d="M4 34 L14 22 L24 14 L34 23 L44 10 L54 20 L64 34"
              fill="none"
              stroke={`url(#${gradId})`}
              strokeWidth="2.2"
              strokeLinejoin="round"
            />
          </g>
        );
      case 'oscilloscope':
        return (
          <path
            d="M4 20 L12 20 L16 11 L21 29 L26 8 L31 32 L36 13 L41 26 L46 16 L51 23 L56 20 L64 20"
            fill="none"
            stroke={`url(#${gradId})`}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        );
      case 'led-matrix':
        return (
          <g fill={`url(#${gradId})`}>
            {[8, 17, 26, 35, 44, 53].map((x, idx) => {
              const rows = [2, 4, 5, 3, 5, 2][idx]!;
              return Array.from({ length: rows }).map((_, r) => (
                <rect key={`${x}-${r}`} x={x} y={31 - r * 5.2} width="6" height="3.5" rx="0.8" />
              ));
            })}
          </g>
        );
      case 'floating-pills':
        return (
          <g fill={`url(#${gradId})`}>
            {[8, 16, 24, 32, 40, 48, 56].map((x, idx) => {
              const y = [22, 14, 9, 17, 7, 15, 21][idx]!;
              return (
                <g key={x}>
                  <rect x={x} y={y} width="4.5" height="7" rx="2.2" />
                  <rect x={x} y={y + 10} width="4.5" height="5" rx="2" opacity="0.4" />
                </g>
              );
            })}
          </g>
        );
      case 'dual-horizon':
        return (
          <g fill="none" stroke={`url(#${gradId})`} strokeLinecap="round">
            <path d="M4 20 Q 18 6, 34 18 T 64 16" strokeWidth="2.3" />
            <line x1="4" y1="21" x2="64" y2="21" strokeWidth="1" opacity="0.45" />
            <path d="M4 22 Q 18 32, 34 24 T 64 25" strokeWidth="1.6" opacity="0.45" />
          </g>
        );
      case 'dot-matrix':
        return (
          <g fill={`url(#${gradId})`}>
            {[8, 16, 24, 32, 40, 48, 56].map((x, idx) => {
              const rows = [2, 3, 4, 3, 4, 2, 2][idx]!;
              return Array.from({ length: rows }).map((_, r) => (
                <rect key={`${x}-${r}`} x={x} y={30 - r * 6} width="4" height="4" rx="1.2" />
              ));
            })}
          </g>
        );
      case 'slanted-bars':
        return (
          <g fill={`url(#${gradId})`} transform="skewX(-15)">
            {[16, 24, 32, 40, 48, 56].map((x, idx) => {
              const h = [11, 20, 26, 17, 24, 13][idx]!;
              return <rect key={x} x={x} y={34 - h} width="4.5" height={h} rx="1" />;
            })}
          </g>
        );
      case 'stereo-strips':
        return (
          <g fill={`url(#${gradId})`}>
            <rect x="33" y="6" width="2" height="28" opacity="0.45" />
            {[9, 15, 21, 27].map((y, idx) => {
              const w = [10, 20, 24, 13][idx]!;
              return (
                <g key={y}>
                  <rect x={31 - w} y={y} width={w} height="3.5" rx="1.5" />
                  <rect x="37" y={y} width={w} height="3.5" rx="1.5" />
                </g>
              );
            })}
          </g>
        );
      case 'particle-stream':
        return (
          <g fill={`url(#${gradId})`}>
            {[
              [9, 26, 3],
              [15, 19, 4],
              [22, 13, 3.5],
              [29, 21, 4],
              [37, 10, 4.5],
              [44, 17, 3.5],
              [51, 23, 3],
              [58, 15, 3.5],
            ].map(([x, y, s], idx) => (
              <rect
                key={idx}
                x={x!}
                y={y!}
                width={s!}
                height={s!}
                transform={`rotate(45 ${x! + s! / 2} ${y! + s! / 2})`}
              />
            ))}
          </g>
        );
      case 'perspective-terrain':
        return (
          <g fill="none" stroke={`url(#${gradId})`} strokeLinecap="round">
            <path d="M16 12 L24 9 L34 11 L44 8 L52 12" strokeWidth="1.2" opacity="0.4" />
            <path d="M10 20 L22 15 L34 18 L46 13 L58 20" strokeWidth="1.6" opacity="0.7" />
            <path d="M4 30 L18 22 L34 26 L48 19 L64 30" strokeWidth="2.2" />
          </g>
        );
      case 'hairline-spectrum':
        return (
          <g stroke={`url(#${gradId})`} strokeWidth="1.9" strokeLinecap="round">
            {Array.from({ length: 14 }).map((_, i) => {
              const x = 6 + i * 4.3;
              const h = 8 + ((Math.sin(i * 0.9) + 1) * 0.5) * 22;
              return <line key={i} x1={x} y1="34" x2={x} y2={34 - h} />;
            })}
          </g>
        );
    }
  };

  return (
    <svg viewBox="0 0 68 40" className="w-full h-10 rounded-md bg-[#0B0E16]">
      <defs>
        <linearGradient
          id={gradId}
          gradientUnits="userSpaceOnUse"
          x1="4"
          y1="0"
          x2="64"
          y2="0"
        >
          <stop offset="0%" stopColor={colors[0]} />
          <stop offset="50%" stopColor={colors[1]} />
          <stop offset="100%" stopColor={colors[2]} />
        </linearGradient>
      </defs>
      {renderShape()}
    </svg>
  );
};
