"use client";

import { useEffect } from "react";
import { X, FileText } from "lucide-react";
import type { CombinationExplanationBlock } from "@/lib/combination-explanation";

type Props = {
  open: boolean;
  onClose: () => void;
  headline: string;
  drugPairLabel: string;
  blocks: CombinationExplanationBlock[];
  onExportPdf: () => void;
};

export function ResultExplanationModal({
  open,
  onClose,
  headline,
  drugPairLabel,
  blocks,
  onExportPdf,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-100 flex items-center justify-center p-4 sm:p-6"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="absolute inset-0 bg-navy-950/55 backdrop-blur-[2px]" aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="result-explain-title"
        className="relative z-101 flex max-h-[min(88dvh,42rem)] w-full max-w-lg flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-navy-900"
      >
        <div className="shrink-0 border-b border-slate-100 px-5 py-4 dark:border-white/10">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="result-explain-title" className="text-lg font-bold text-navy-950 dark:text-white">
                Why this result?
              </h2>
              <p className="mt-0.5 text-sm font-semibold text-slate-700 dark:text-slate-200">{headline}</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{drugPairLabel}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 dark:hover:bg-white/10 dark:hover:text-slate-200"
              aria-label="Close"
            >
              <X size={22} />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div className="space-y-5 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
            {blocks.map((b, i) => (
              <div key={i}>
                {b.heading ? (
                  <h3 className="mb-1.5 font-bold text-navy-950 dark:text-white">{b.heading}</h3>
                ) : null}
                <p>{b.body}</p>
              </div>
            ))}
          </div>
          <p className="mt-6 text-xs text-slate-500 dark:text-slate-400">
            Educational only — not medical advice. A PDF includes this summary plus medication blurbs from the app dictionary.
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2 border-t border-slate-100 px-5 py-4 dark:border-white/10">
          <button
            type="button"
            onClick={() => {
              onExportPdf();
            }}
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-linear-to-r from-brand-600 to-brand-500 px-4 py-2.5 text-sm font-bold text-white shadow-md"
          >
            <FileText size={18} /> Download PDF
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-bold text-slate-700 dark:border-white/15 dark:bg-white/5 dark:text-slate-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
