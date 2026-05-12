"use client";

import { useRouter } from "next/navigation";
import { ClipboardList, ExternalLink, Trash2, Download } from "lucide-react";
import { db } from "@/lib/db";
import { useLiveQuery } from "dexie-react-hooks";
import { generateHistoryPdf } from "@/lib/pdf-generator";
import { simpleInteractionHeadline, type ReportSource } from "@/lib/ddi-report-labels";
import { useAppToast } from "@/components/ToastProvider";

type Severity = "none" | "moderate" | "severe";

const STORAGE_KEY_LAST_CHECK = "clinicalddi_last_check_v1";

const SEVERITY_CONFIG: Record<Severity, { text: string; dot: string }> = {
  none: {
    text: "#14532D",
    dot: "#22C55E",
  },
  moderate: {
    text: "#78350F",
    dot: "#F59E0B",
  },
  severe: {
    text: "#881337",
    dot: "#F43F5E",
  },
};

const HISTORY_NEUTRAL_DOT = "#64748B";

export default function HistoryPage() {
  const router = useRouter();
  const { toast, success } = useAppToast();

  const history = useLiveQuery(
    () => db.history.orderBy('timestamp').reverse().toArray()
  ) || [];

  function clearHistory() {
    toast("Delete all saved checks from this browser?", {
      description: "This cannot be undone.",
      action: {
        label: "Delete all",
        onClick: () => {
          void (async () => {
            await db.history.clear();
            success("History deleted.");
          })();
        },
      },
      cancel: { label: "Cancel" },
    });
  }

  function exportHistoryPdf() {
    generateHistoryPdf(history);
  }

  return (
    <main className="w-full max-w-5xl mx-auto px-6 py-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-12 animate-slide-up">
        <div>
          <h1 className="text-3xl md:text-4xl font-outfit font-extrabold tracking-tight text-navy-950 dark:text-white mb-2 flex items-center gap-3">
            <ClipboardList className="text-brand-500" /> Interaction History
          </h1>
          <p className="text-slate-600 dark:text-slate-400 max-w-xl leading-relaxed">
            Past checks stay on <span className="font-medium text-slate-700 dark:text-slate-300">this browser only</span>. They are
            not uploaded to our servers.
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-500 mt-3 max-w-xl leading-relaxed">
            New saves use today&apos;s <span className="font-medium text-slate-600 dark:text-slate-400">structure pathway</span>{" "}
            (on-device lookup + molecule comparison + local scorer)—not BioBERT or other cloud name models. Rows from an older
            name-only pipeline are labeled below when we still recognize them.
          </p>
        </div>

        {history.length > 0 && (
          <div className="flex gap-3 mt-4 md:mt-0">
            <button
              type="button"
              onClick={exportHistoryPdf}
              title="Downloads every saved check in one PDF in the same order as this list."
              className="px-5 py-2.5 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-all flex items-center gap-2"
            >
              <Download size={18} /> Export PDF
            </button>
            <button
              type="button"
              onClick={clearHistory}
              aria-label="Delete all history"
              className="px-5 py-2.5 bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400 font-bold rounded-xl hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-all"
            >
              <Trash2 size={18} />
            </button>
          </div>
        )}
      </div>

      {history.length === 0 ? (
        <div className="h-[400px] glass rounded-3xl p-8 flex flex-col items-center justify-center text-center border border-dashed border-slate-300 dark:border-slate-700 animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-navy-800 text-slate-400 flex items-center justify-center mb-6">
            <ClipboardList size={32} />
          </div>
          <h3 className="text-lg font-bold text-navy-950 dark:text-white mb-2">No checks saved yet</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md leading-relaxed">
            Run a checker on the Checker tab. When you analyze a pair, it can appear here for your reference—still only on this
            device.
          </p>
          <button type="button" onClick={() => router.push("/dashboard")} className="mt-8 px-6 py-3 bg-brand-600 hover:bg-brand-500 text-white font-bold rounded-2xl transition-all shadow-lg hover:shadow-brand-500/25">
            Go to Checker
          </button>
        </div>
      ) : (
        <>
          <div className="grid gap-4">
          {history.map((h, i) => {
            const source = (h.source ?? "structure_fp") as ReportSource;
            const rowHeadline = simpleInteractionHeadline({ severity: h.severity, source });
            const neutralRow = source === "structure_similarity";
            const dot = neutralRow ? HISTORY_NEUTRAL_DOT : SEVERITY_CONFIG[h.severity].dot;
            const textColor = neutralRow ? undefined : SEVERITY_CONFIG[h.severity].text;
            const date = new Date(h.timestamp);
            return (
              <div
                key={h.id}
                className="group p-6 glass rounded-2xl hover:shadow-lg transition-all cursor-pointer animate-slide-up flex flex-col md:flex-row md:items-center gap-6"
                style={{ animationDelay: `${Math.min(0.5, 0.05 * i)}s` }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    if (typeof window !== "undefined") {
                      window.localStorage.setItem(STORAGE_KEY_LAST_CHECK, JSON.stringify({ drug1: h.drug1, drug2: h.drug2 }));
                    }
                    router.push("/dashboard");
                  }
                }}
                onClick={() => {
                  if (typeof window !== "undefined") {
                    window.localStorage.setItem(STORAGE_KEY_LAST_CHECK, JSON.stringify({ drug1: h.drug1, drug2: h.drug2 }));
                  }
                  router.push("/dashboard");
                }}
              >
                <div className="flex-1 flex items-start gap-4">
                  <div className="mt-1 w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: dot, boxShadow: `0 0 12px ${dot}80` }} />
                  <div>
                    <h3 className="text-xl font-bold text-navy-950 dark:text-white mb-1">
                      {h.drug1} <span className="text-slate-400 font-normal mx-1">+</span> {h.drug2}
                    </h3>
                    <p
                      className={`text-sm font-medium ${neutralRow ? "text-slate-600 dark:text-slate-300" : ""}`}
                      style={textColor ? { color: textColor } : undefined}
                    >
                      {rowHeadline}
                    </p>
                  </div>
                </div>

                <div className="flex md:flex-col items-center md:items-end justify-between md:justify-center gap-3 border-t md:border-t-0 md:border-l border-slate-200 dark:border-white/10 pt-4 md:pt-0 md:pl-6 min-w-[140px]">
                  <div className="text-right">
                    <div className="text-xs font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {date.toLocaleDateString()} · {date.toLocaleTimeString()}
                    </div>
                    <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 opacity-90">
                      Opens in Checker
                    </div>
                  </div>
                  <div className="hidden md:flex text-brand-500 opacity-0 group-hover:opacity-100 transition-opacity translate-x-2 group-hover:translate-x-0">
                    <ExternalLink size={20} aria-hidden />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        </>
      )}
    </main>
  );
}
