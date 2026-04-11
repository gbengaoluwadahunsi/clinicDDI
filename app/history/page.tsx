"use client";

import { useRouter } from "next/navigation";
import { ClipboardList, ExternalLink, Trash2, FileJson } from "lucide-react";
import { db } from "@/lib/db";
import { useLiveQuery } from "dexie-react-hooks";

type Severity = "none" | "moderate" | "severe";

const STORAGE_KEY_LAST_CHECK = "clinicalddi_last_check_v1";

const SEVERITY_CONFIG: Record<Severity, { label: string; text: string; dot: string; badge: string; badgeText: string }> = {
  none: {
    label: "No interaction detected",
    text: "#14532D",
    dot: "#22C55E",
    badge: "bg-green-100 dark:bg-green-900/40",
    badgeText: "text-green-800 dark:text-green-300"
  },
  moderate: {
    label: "Moderate interaction",
    text: "#78350F",
    dot: "#F59E0B",
    badge: "bg-amber-100 dark:bg-amber-900/40",
    badgeText: "text-amber-800 dark:text-amber-300"
  },
  severe: {
    label: "Severe interaction — review required",
    text: "#881337",
    dot: "#F43F5E",
    badge: "bg-rose-100 dark:bg-rose-900/40",
    badgeText: "text-rose-800 dark:text-rose-300"
  },
};

export default function HistoryPage() {
  const router = useRouter();

  const history = useLiveQuery(
    () => db.history.orderBy('timestamp').reverse().toArray()
  ) || [];

  async function clearHistory() {
    if (confirm("Permanently delete all clinical history records from this device?")) {
      await db.history.clear();
    }
  }

  function exportHistory() {
    const data = JSON.stringify(history, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ClinicalDDI_FullHistory_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
  }

  return (
    <main className="w-full max-w-5xl mx-auto px-6 py-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-12 animate-slide-up">
        <div>
          <h1 className="text-3xl md:text-4xl font-outfit font-extrabold tracking-tight text-navy-950 dark:text-white mb-2 flex items-center gap-3">
            <ClipboardList className="text-brand-500" /> Interaction History
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            A secure, IndexDB-backed clinical log stored entirely on this workstation.
          </p>
        </div>

        {history.length > 0 && (
          <div className="flex gap-3 mt-4 md:mt-0">
            <button
              onClick={exportHistory}
              className="px-5 py-2.5 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-all flex items-center gap-2"
            >
              <FileJson size={18} /> Export
            </button>
            <button
              onClick={clearHistory}
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
          <h3 className="text-lg font-bold text-navy-950 dark:text-white mb-2">Local Audit Log Empty</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md">
            All clinical intelligence sessions are recorded locally using encrypted browser storage.
          </p>
          <button onClick={() => router.push("/dashboard")} className="mt-8 px-6 py-3 bg-brand-600 hover:bg-brand-500 text-white font-bold rounded-2xl transition-all shadow-lg hover:shadow-brand-500/25">
            Initialize New Session
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {history.map((h, i) => {
            const cfg = SEVERITY_CONFIG[h.severity];
            const date = new Date(h.timestamp);
            return (
              <div
                key={h.id}
                className="group p-6 glass rounded-2xl hover:shadow-lg transition-all cursor-pointer animate-slide-up flex flex-col md:flex-row md:items-center gap-6"
                style={{ animationDelay: `${Math.min(0.5, 0.05 * i)}s` }}
                onClick={() => {
                  if (typeof window !== "undefined") {
                    window.localStorage.setItem(STORAGE_KEY_LAST_CHECK, JSON.stringify({ drug1: h.drug1, drug2: h.drug2 }));
                  }
                  router.push("/dashboard");
                }}
              >
                <div className="flex-1 flex items-start gap-4">
                  <div className="mt-1 w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: cfg.dot, boxShadow: `0 0 12px ${cfg.dot}80` }} />
                  <div>
                    <h3 className="text-xl font-bold text-navy-950 dark:text-white mb-1">
                      {h.drug1} <span className="text-slate-400 font-normal mx-1">+</span> {h.drug2}
                    </h3>
                    <p className="text-sm font-medium mb-3" style={{ color: cfg.text }}>
                      {cfg.label}
                    </p>

                    {h.classProbs && (
                      <div className="flex gap-4 text-xs font-semibold text-slate-500 dark:text-slate-400">
                        <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-green-500" /> Saf {(h.classProbs[0] * 100).toFixed(0)}%</span>
                        <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Mod {(h.classProbs[1] * 100).toFixed(0)}%</span>
                        <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-rose-500" /> Sev {(h.classProbs[2] * 100).toFixed(0)}%</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex md:flex-col items-center md:items-end justify-between md:justify-center gap-2 border-t md:border-t-0 md:border-l border-slate-200 dark:border-white/10 pt-4 md:pt-0 md:pl-6">
                  <div className={`px-3 py-1 rounded-full text-xs font-bold ${cfg.badge} ${cfg.badgeText}`}>
                    Top Class {(h.confidence * 100).toFixed(1)}%
                  </div>
                  <div className="text-xs font-medium text-slate-400 whitespace-nowrap">
                    {date.toLocaleDateString()} · {date.toLocaleTimeString()}
                  </div>
                  <div className="hidden md:flex text-brand-500 opacity-0 group-hover:opacity-100 transition-opacity translate-x-2 group-hover:translate-x-0 mt-2">
                    <ExternalLink size={20} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
