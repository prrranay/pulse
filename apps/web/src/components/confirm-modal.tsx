import React from 'react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  isDanger?: boolean;
}

export default function ConfirmModal({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isDanger = false,
}: ConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-xl border border-slate-800 bg-slate-950 p-6 shadow-2xl space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-2">
          <h3 className="text-base font-bold text-slate-100">{title}</h3>
          <p className="text-xs text-slate-400 leading-relaxed">{message}</p>
        </div>
        <div className="flex items-center justify-end gap-2.5 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-slate-800 bg-slate-900/50 hover:bg-slate-900 px-3.5 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-all"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`rounded-lg px-3.5 py-2 text-xs font-semibold text-white transition-all shadow-md ${
              isDanger
                ? 'bg-red-600 hover:bg-red-500 shadow-red-950/20'
                : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-950/20'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
