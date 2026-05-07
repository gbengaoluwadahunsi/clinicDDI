"use client";

import { useState, useEffect, useRef } from "react";
import * as ort from "onnxruntime-web";
import { useRouter } from "next/navigation";
import { Tokenizer } from "@huggingface/tokenizers";
import { Activity, ShieldCheck, Download, Trash2, FileJson, Lock, FileText, Globe } from "lucide-react";
import { db } from "@/lib/db";
import { useLiveQuery } from "dexie-react-hooks";
import { useSession } from "next-auth/react";
import { generateClinicalReport } from "@/lib/pdf-generator";
import tokenizerJson from "@/lib/ddi/tokenizer.json";
import tokenizerConfig from "@/lib/ddi/tokenizer_config.json";

// ── Types ──────────────────────────────────────────────────────────────────
type Severity = "none" | "moderate" | "severe";
interface CheckResult {
  id: string;
  drug1: string;
  drug2: string;
  severity: Severity;
  confidence: number;
  classProbs?: [number, number, number];
  probMargin?: number;
  normalizedEntropy?: number;
  latencyMs: number;
  timestamp: Date;
}

// ── Constants ──────────────────────────────────────────────────────────────
const SEVERITY_CONFIG: Record<Severity, {
  label: string; bg: string; border: string;
  text: string; badge: string; badgeText: string; dot: string;
}> = {
  none: {
    label: "No interaction detected",
    bg: "#F0FDF4", border: "#86EFAC", text: "#14532D",
    badge: "#DCFCE7", badgeText: "#166534", dot: "#22C55E",
  },
  moderate: {
    label: "Moderate interaction",
    bg: "#FFFBEB", border: "#FCD34D", text: "#78350F",
    badge: "#FEF3C7", badgeText: "#92400E", dot: "#F59E0B",
  },
  severe: {
    label: "Severe interaction — review required",
    bg: "#FFF1F2", border: "#FDA4AF", text: "#881337",
    badge: "#FFE4E6", badgeText: "#9F1239", dot: "#F43F5E",
  },
};

const COMMON_DRUGS = [
  "Aspirin", "Warfarin", "Metformin", "Lisinopril", "Atorvastatin",
  "Omeprazole", "Amlodipine", "Metoprolol", "Simvastatin", "Paracetamol",
  "Ibuprofen", "Amoxicillin", "Ciprofloxacin", "Digoxin", "Clopidogrel",
  "Fluoxetine", "Tramadol", "Lithium", "Methotrexate", "Rifampicin",
];

const STORAGE_KEY_HISTORY = "clinicalddi_history_v1";
const STORAGE_KEY_LAST_CHECK = "clinicalddi_last_check_v1";

const MODEL_SEQ_LEN = 128;
const PAD_TOKEN_ID = 0;

function padOrTruncateBertTensors(
  ids: number[],
  attentionMask: number[],
  tokenTypeIds: number[] | undefined,
  maxLen: number,
  padId: number
) {
  const tt = tokenTypeIds ?? new Array(ids.length).fill(0);
  let outIds = ids.slice();
  let outMask = attentionMask.slice();
  let outType = tt.slice();
  if (outIds.length > maxLen) {
    outIds = outIds.slice(0, maxLen);
    outMask = outMask.slice(0, maxLen);
    outType = outType.slice(0, maxLen);
  } else {
    while (outIds.length < maxLen) {
      outIds.push(padId);
      outMask.push(0);
      outType.push(0);
    }
  }
  return { ids: outIds, attention_mask: outMask, token_type_ids: outType };
}

function entropyBits(probs: number[]): number {
  let h = 0;
  for (const p of probs) {
    if (p > 1e-12) h -= p * Math.log2(p);
  }
  return h;
}

function marginAndAmbiguity(probs: [number, number, number]): {
  probMargin: number;
  normalizedEntropy: number;
} {
  const sorted = [...probs].sort((a, b) => b - a);
  const probMargin = sorted[0] - sorted[1];
  const maxH = Math.log2(3);
  const normalizedEntropy = Math.min(1, Math.max(0, entropyBits(probs) / maxH));
  return { probMargin, normalizedEntropy };
}

export default function ClinicalDDI() {
  const [session, setSession] = useState<ort.InferenceSession | null>(null);
  const [modelReady, setModelReady] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [tokenizer, setTokenizer] = useState<Tokenizer | null>(null);
  const [drug1, setDrug1] = useState("");
  const [drug2, setDrug2] = useState("");
  const [checking, setChecking] = useState(false);
  const [guestCount, setGuestCount] = useState(0);
  const [result, setResult] = useState<CheckResult | null>(null);

  const { data: authSession } = useSession();
  const isPro = authSession?.user?.plan === "PRO";

  const localHistory = useLiveQuery(() => db.history.orderBy('timestamp').reverse().limit(50).toArray()) || [];

  const router = useRouter();
  const [tab, setTab] = useState<"checker" | "history" | "about">("checker");
  const pendingAutoCheckRef = useRef<{ drug1: string; drug2: string } | null>(null);
  const [historyHydrated, setHistoryHydrated] = useState(false);
  const [suggestions1, setSuggestions1] = useState<string[]>([]);
  const [suggestions2, setSuggestions2] = useState<string[]>([]);
  const inputRef1 = useRef<HTMLInputElement>(null);
  const inputRef2 = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const modelUrl = "/ddi_v2_single.onnx";
        const s = await ort.InferenceSession.create(modelUrl, {
          executionProviders: ["wasm"],
        });
        if (cancelled) return;
        setSession(s);
        setModelReady(true);
      } catch (e) {
        if (cancelled) return;
        setLoadError("Model failed to load.");
        console.error(e);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    try {
      setTokenizer(new Tokenizer(tokenizerJson as object, tokenizerConfig as object));
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    setHistoryHydrated(true);
    const storedCount = localStorage.getItem("ddi_guest_count");
    setGuestCount(parseInt(storedCount || "0"));
  }, []);

  async function runCheck(forDrug1?: string, forDrug2?: string) {
    const d1 = (forDrug1 ?? drug1).trim();
    const d2 = (forDrug2 ?? drug2).trim();
    if (!session || !tokenizer || !d1 || !d2) return;
    setDrug1(d1);
    setDrug2(d2);
    setChecking(true);
    setResult(null);

    try {
      const enc = tokenizer.encode(d1, {
        text_pair: d2,
        add_special_tokens: true,
        return_token_type_ids: true,
      }) as any;

      const padded = padOrTruncateBertTensors(
        enc.ids,
        enc.attention_mask,
        enc.token_type_ids,
        MODEL_SEQ_LEN,
        PAD_TOKEN_ID
      );

      const ids = BigInt64Array.from(padded.ids.map(v => BigInt(v)));
      const mask = BigInt64Array.from(padded.attention_mask.map(v => BigInt(v)));
      const tids = BigInt64Array.from(padded.token_type_ids.map(v => BigInt(v)));

      const t0 = performance.now();
      const out = await session.run({
        input_ids: new ort.Tensor("int64", ids, [1, MODEL_SEQ_LEN]),
        attention_mask: new ort.Tensor("int64", mask, [1, MODEL_SEQ_LEN]),
        token_type_ids: new ort.Tensor("int64", tids, [1, MODEL_SEQ_LEN]),
      });
      const latencyMs = Math.round(performance.now() - t0);

      const logits = Array.from(out.logits.data as Float32Array);
      const maxLogit = Math.max(...logits);
      const exp = logits.map(v => Math.exp(v - maxLogit));
      const sum = exp.reduce((a, b) => a + b, 0);
      const probs = exp.map(v => v / sum);
      const idx = probs.indexOf(Math.max(...probs));
      const severities: Severity[] = ["none", "moderate", "severe"];
      const cp = [probs[0], probs[1], probs[2]] as [number, number, number];
      const { probMargin, normalizedEntropy } = marginAndAmbiguity(cp);

      const r: CheckResult = {
        id: crypto.randomUUID(),
        drug1: d1,
        drug2: d2,
        severity: severities[idx],
        confidence: probs[idx],
        classProbs: cp,
        probMargin,
        normalizedEntropy,
        latencyMs,
        timestamp: new Date(),
      };
      setResult(r);

      await db.history.add({
        drug1: r.drug1,
        drug2: r.drug2,
        severity: r.severity,
        confidence: r.confidence,
        classProbs: r.classProbs,
        latencyMs: r.latencyMs,
        timestamp: Date.now(),
      });

      if (!isPro) {
        const newCount = guestCount + 1;
        setGuestCount(newCount);
        localStorage.setItem("ddi_guest_count", newCount.toString());
      }
    } catch (e) { console.error(e); }
    setChecking(false);
  }

  function swap() { setDrug1(drug2); setDrug2(drug1); setResult(null); }
  function clear() { setDrug1(""); setDrug2(""); setResult(null); }

  return (
    <main className="w-full max-w-5xl mx-auto px-6 py-12">
      <div className="flex justify-center mb-6 animate-fade-in">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold uppercase tracking-widest backdrop-blur-md">
          <Lock size={14} className="animate-pulse" />
          Off-Cloud Inference Active • 100% Privacy
        </div>
      </div>

      <div className="text-center mb-12 animate-slide-up">
        <h1 className="text-4xl md:text-5xl font-outfit font-extrabold tracking-tight text-navy-950 dark:text-white mb-4">
          Enterprise Drug Intelligence
        </h1>
        <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
          Privacy-first validation. 1 million+ combinations processed entirely in your browser.
        </p>
      </div>

      <div className="grid lg:grid-cols-[1fr_400px] gap-8 items-start">
        <div className="space-y-6">
          <div className="glass rounded-3xl p-8 shadow-xl shadow-slate-200/50 dark:shadow-none animate-slide-up">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-bold text-navy-950 dark:text-white flex items-center gap-2">
                <Activity className="text-brand-500" /> Interaction Check
              </h2>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-white/5 text-xs font-semibold">
                <div className={`w-2 h-2 rounded-full shadow-[0_0_8px] ${modelReady ? "bg-green-500 shadow-green-500" : "bg-amber-500 animate-pulse"}`} />
                <span className="text-slate-600 dark:text-slate-300">{modelReady ? "Engine Ready" : "Loading..."}</span>
              </div>
            </div>

            <div className="flex flex-col gap-6">
              <input
                value={drug1}
                onChange={(e) => setDrug1(e.target.value)}
                placeholder="Primary Medication"
                className="w-full px-5 py-4 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl text-lg font-medium text-navy-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all font-outfit"
              />
              <div className="flex justify-center -my-2">
                <button onClick={swap} className="w-12 h-12 rounded-full bg-white dark:bg-navy-800 border border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-400 hover:text-brand-500 transition-all">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 10v12" /><path d="M15 14v8" /><path d="M11 14l4-4 4 4" /><path d="M3 14l4-4 4 4" /></svg>
                </button>
              </div>
              <input
                value={drug2}
                onChange={(e) => setDrug2(e.target.value)}
                placeholder="Secondary Medication"
                className="w-full px-5 py-4 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl text-lg font-medium text-navy-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all font-outfit"
              />
              <div className="flex gap-4 mt-6">
                <button
                  onClick={() => runCheck()}
                  disabled={checking || !modelReady || !drug1 || !drug2}
                  className="flex-1 py-4 bg-brand-600 hover:bg-brand-500 disabled:bg-slate-300 text-white font-bold rounded-2xl transition-all shadow-lg active:scale-[0.98]"
                >
                  {checking ? "Analyzing..." : "Run Intelligence Check"}
                </button>
                <button onClick={clear} className="px-8 py-4 bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 font-bold rounded-2xl transition-all">Clear</button>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {result ? (() => {
            const cfg = SEVERITY_CONFIG[result.severity];
            return (
              <div className="glass rounded-3xl p-6 shadow-xl animate-fade-in border-t-8" style={{ borderTopColor: cfg.dot }}>
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: cfg.dot }}>Intelligence Report</div>
                    <div className="text-3xl font-extrabold" style={{ color: cfg.text }}>{cfg.label.split('—')[0]}</div>
                  </div>
                  <div className="px-3 py-1 rounded-full text-sm font-bold bg-white/20" style={{ color: cfg.badgeText }}>{(result.confidence * 100).toFixed(1)}% Conf</div>
                </div>

                <div className="space-y-4 mb-8">
                  <div className="flex justify-between p-3 rounded-lg bg-slate-50 dark:bg-white/5 text-sm">
                    <span className="font-semibold">Inferenced In</span>
                    <span>{result.latencyMs}ms</span>
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  {isPro && (
                    <button
                      onClick={() => generateClinicalReport(localHistory)}
                      className="w-full flex items-center justify-center gap-2 py-4 bg-gradient-to-r from-brand-600 to-brand-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-brand-500/25 transition-all"
                    >
                      <FileText size={16} /> Generate Clinical PDF
                    </button>
                  )}
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        const data = JSON.stringify(localHistory, null, 2);
                        const blob = new Blob([data], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a'); a.href = url; a.download = `Report.json`; a.click();
                      }}
                      className="flex-1 flex items-center justify-center gap-2 py-3 bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-all"
                    >
                      <FileJson size={14} /> JSON Data
                    </button>
                    <button
                      onClick={async () => {
                        if (confirm("Clear history?")) { await db.history.clear(); setResult(null); }
                      }}
                      className="px-4 py-3 bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400 rounded-xl transition-all"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })() : (
            <div className="h-full min-h-[300px] glass rounded-3xl p-8 flex flex-col items-center justify-center text-center border border-dashed border-slate-300 animate-slide-up">
              <Lock size={32} className="text-slate-300 mb-6" />
              <h3 className="text-lg font-bold mb-2">Awaiting Protocols</h3>
              <p className="text-sm text-slate-500">Run a check to see reports.</p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}