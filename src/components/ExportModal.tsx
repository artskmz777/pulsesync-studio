import React from 'react';
import { AlertCircle, CheckCircle2, Download, Loader2, X, XCircle } from 'lucide-react';
import type { ExportProgressState } from '../types/studio';

interface ExportModalProps {
  state: ExportProgressState;
  onCancel: () => void;
  onClose: () => void;
}

function formatSeconds(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatBytes(bytes: number | undefined): string {
  if (!bytes) return '—';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export const ExportModal: React.FC<ExportModalProps> = ({ state, onCancel, onClose }) => {
  if (!state.isOpen) return null;

  const isRunning =
    state.status === 'preparing' || state.status === 'rendering' || state.status === 'muxing';

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl bg-[#131722] border border-slate-700/80 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-sm font-bold text-white">ส่งออกวิดีโอ MP4 (Offline WebCodecs)</h2>
          {!isRunning && (
            <button
              type="button"
              onClick={onClose}
              aria-label="ปิดหน้าต่าง"
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {isRunning && (
            <>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center shrink-0">
                  <Loader2 className="w-5 h-5 text-cyan-300 animate-spin" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-white">{state.message}</div>
                  <div className="text-xs text-slate-400 font-mono mt-0.5">
                    เฟรม {state.currentFrame.toLocaleString()} /{' '}
                    {state.totalFrames.toLocaleString()}
                  </div>
                </div>
                <div className="text-lg font-mono font-bold text-cyan-300">
                  {state.progress}%
                </div>
              </div>

              <div className="h-2.5 w-full rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-cyan-400 via-blue-500 to-violet-500 transition-all duration-150"
                  style={{ width: `${state.progress}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
                <span>เวลาที่ใช้: {formatSeconds(state.elapsedSeconds)}</span>
                <span>เวลาที่เหลือโดยประมาณ: {formatSeconds(state.etaSeconds)}</span>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={onCancel}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/35 px-4 py-2 text-xs font-semibold text-rose-200 transition-colors cursor-pointer"
                >
                  <XCircle className="w-4 h-4" />
                  <span>ยกเลิกการเรนเดอร์</span>
                </button>
              </div>
            </>
          )}

          {state.status === 'completed' && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-3.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <div className="text-sm font-bold text-emerald-200">เรนเดอร์ไฟล์ MP4 สำเร็จ!</div>
                  <div className="text-xs text-slate-300 mt-1 break-all font-mono">
                    {state.outputFileName}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    ขนาดไฟล์: {formatBytes(state.outputSizeBytes)} • ใช้เวลา{' '}
                    {formatSeconds(state.elapsedSeconds)}
                  </div>
                </div>
              </div>

              {state.outputBlobUrl && (
                <video
                  src={state.outputBlobUrl}
                  controls
                  className="w-full max-h-56 rounded-xl bg-black border border-slate-800"
                />
              )}

              <div className="flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 cursor-pointer"
                >
                  ปิด
                </button>
                {state.outputBlobUrl && (
                  <a
                    href={state.outputBlobUrl}
                    download={state.outputFileName ?? 'PulseSync_Export.mp4'}
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-violet-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-cyan-500/20 hover:brightness-110"
                  >
                    <Download className="w-4 h-4" />
                    <span>ดาวน์โหลดไฟล์ MP4</span>
                  </a>
                )}
              </div>
            </div>
          )}

          {state.status === 'cancelled' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-xl bg-slate-800/70 border border-slate-700 p-3.5 text-slate-200 text-xs">
                <XCircle className="w-5 h-5 text-slate-400 shrink-0" />
                <span>ยกเลิกการเรนเดอร์เรียบร้อยแล้ว</span>
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl bg-slate-800 hover:bg-slate-700 px-4 py-2 text-xs font-semibold text-white cursor-pointer"
                >
                  ตกลง
                </button>
              </div>
            </div>
          )}

          {state.status === 'error' && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-xl bg-rose-500/10 border border-rose-500/30 p-3.5">
                <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                <div className="text-xs text-rose-200 leading-relaxed">
                  <div className="font-bold mb-1">ไม่สามารถส่งออกไฟล์ MP4 ได้</div>
                  <div>{state.errorMessage ?? 'เกิดข้อผิดพลาดไม่ทราบสาเหตุ'}</div>
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl bg-slate-800 hover:bg-slate-700 px-4 py-2 text-xs font-semibold text-white cursor-pointer"
                >
                  ปิด
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
