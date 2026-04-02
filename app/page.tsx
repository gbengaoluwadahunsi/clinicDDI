"use client";

import { useState, useEffect, useRef } from "react";
import * as ort from "onnxruntime-web";
import { useRouter } from "next/navigation";
import { Tokenizer } from "@huggingface/tokenizers";

// ── Types ──────────────────────────────────────────────────────────────────
type Severity = "none" | "moderate" | "severe";
interface CheckResult {
  id: string;
  drug1: string;
  drug2: string;
  severity: Severity;
  confidence: number;
  /** Softmax probabilities for [none, moderate, severe] — sum ≈ 1 */
  classProbs?: [number, number, number];
  /** Top − second-best probability (0–1). Higher = clearer separation between 1st and 2nd class. */
  probMargin?: number;
  /** 0 = one class dominates, 1 = near-uniform (max uncertainty for 3 classes). */
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
  "Aspirin","Warfarin","Metformin","Lisinopril","Atorvastatin",
  "Omeprazole","Amlodipine","Metoprolol","Simvastatin","Paracetamol",
  "Ibuprofen","Amoxicillin","Ciprofloxacin","Digoxin","Clopidogrel",
  "Fluoxetine","Tramadol","Lithium","Methotrexate","Rifampicin",
];

const STORAGE_KEY_HISTORY = "clinicalddi_history_v1";
const STORAGE_KEY_LAST_CHECK = "clinicalddi_last_check_v1";

/** ONNX model fixed sequence length */
const MODEL_SEQ_LEN = 128;
/** BERT `[PAD]` pad token id from this tokenizer's `added_tokens` */
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

/** Shannon entropy (bits) for a discrete distribution */
function entropyBits(probs: number[]): number {
  let h = 0;
  for (const p of probs) {
    if (p > 1e-12) h -= p * Math.log2(p);
  }
  return h;
}

/** Top − second-best; max entropy for 3-way is log2(3) bits (uniform). */
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

// ── Main Component ─────────────────────────────────────────────────────────
export default function ClinicalDDI() {
  const [session, setSession]     = useState<ort.InferenceSession | null>(null);
  const [modelReady, setModelReady] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [tokenizer, setTokenizer] = useState<Tokenizer | null>(null);
  const [drug1, setDrug1]         = useState("");
  const [drug2, setDrug2]         = useState("");
  const [checking, setChecking]   = useState(false);
  const [result, setResult]       = useState<CheckResult | null>(null);
  /** Start empty so SSR and first client paint match; hydrate from localStorage after mount. */
  const [history, setHistory]     = useState<CheckResult[]>([]);
  const router = useRouter();
  const [tab, setTab]             = useState<"checker"|"history"|"about">("checker");
  const pendingAutoCheckRef = useRef<{ drug1: string; drug2: string } | null>(null);
  /** When true, `history` has been loaded from localStorage (or confirmed empty) — safe to persist. */
  const [historyHydrated, setHistoryHydrated] = useState(false);
  const [suggestions1, setSuggestions1] = useState<string[]>([]);
  const [suggestions2, setSuggestions2] = useState<string[]>([]);
  const inputRef1 = useRef<HTMLInputElement>(null);
  const inputRef2 = useRef<HTMLInputElement>(null);

  function switchTab(nextTab: "checker" | "history" | "about") {
    // Prevent autocomplete dropdowns from visually/interaction-blocking the nav.
    setSuggestions1([]);
    setSuggestions2([]);
    setTab(nextTab);
    // Update URL so navigation is obvious and resilient.
    if (nextTab === "checker") {
      router.push("/", { scroll: false });
    } else if (nextTab === "history") {
      router.push("/history", { scroll: false });
    } else {
      router.push("/about", { scroll: false });
    }
  }

  // Load ONNX model
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const modelUrl = "/ddi_model_single.onnx";
        const head = await fetch(modelUrl, { method: "HEAD" });
        if (!head.ok) {
          setLoadError("Model is missing. Please add `ddi_model_single.onnx` to `public/`.");
          return;
        }

        const s = await ort.InferenceSession.create(modelUrl, {
          executionProviders: ["wasm"],
        });
        if (cancelled) return;
        setSession(s);
        setModelReady(true);
      } catch (e) {
        if (cancelled) return;
        setLoadError("Model failed to load. Ensure `ddi_model_single.onnx` exists in `public/`.");
        console.error(e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Load tokenizer (offline, from public/)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [tokJson, tokCfg] = await Promise.all([
          fetch("/tokenizer.json").then(r => r.json()),
          fetch("/tokenizer_config.json").then(r => r.json()),
        ]);
        if (cancelled) return;
        setTokenizer(new Tokenizer(tokJson, tokCfg));
      } catch (e) {
        // Tokenizer is required for meaningful model output; keep the UI usable but log the issue.
        console.error("Failed to load tokenizer files from /public", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Hydrate history from localStorage after mount (SSR-safe — avoids tab label / count mismatch).
  useEffect(() => {
    try {
      const rawHistory = window.localStorage.getItem(STORAGE_KEY_HISTORY);
      if (rawHistory) {
        const parsed = JSON.parse(rawHistory) as Array<Omit<CheckResult, "timestamp"> & { timestampMs: number }>;
        setHistory(
          parsed.map(item => ({
            ...item,
            timestamp: new Date(item.timestampMs),
          }))
        );
      }
    } catch (e) {
      console.error(e);
    } finally {
      setHistoryHydrated(true);
    }
  }, []);

  // Load pending re-run from localStorage into a ref (avoid setState-in-effect lint).
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const rawPending = window.localStorage.getItem(STORAGE_KEY_LAST_CHECK);
      if (!rawPending) return;
      const parsedPending = JSON.parse(rawPending) as { drug1: string; drug2: string };
      if (parsedPending?.drug1 && parsedPending?.drug2) {
        pendingAutoCheckRef.current = parsedPending;
      }
      window.localStorage.removeItem(STORAGE_KEY_LAST_CHECK);
    } catch (e) {
      console.error(e);
    }
  }, []);

  // Persist check history to localStorage.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!historyHydrated) return;
    try {
      const serialized = history.map(h => ({
        id: h.id,
        drug1: h.drug1,
        drug2: h.drug2,
        severity: h.severity,
        confidence: h.confidence,
        classProbs: h.classProbs,
        probMargin: h.probMargin,
        normalizedEntropy: h.normalizedEntropy,
        latencyMs: h.latencyMs,
        timestampMs: h.timestamp.getTime(),
      }));
      window.localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(serialized));
    } catch (e) {
      console.error(e);
    }
  }, [history, historyHydrated]);

  // Autocomplete
  function getSuggestions(val: string) {
    if (!val.trim()) return [];
    return COMMON_DRUGS.filter(d =>
      d.toLowerCase().startsWith(val.toLowerCase()) && d.toLowerCase() !== val.toLowerCase()
    ).slice(0, 5);
  }

  async function runCheck(forDrug1?: string, forDrug2?: string) {
    const d1 = (forDrug1 ?? drug1).trim();
    const d2 = (forDrug2 ?? drug2).trim();
    if (!session || !tokenizer || !d1 || !d2) return;
    // Keep the inputs in sync when history triggers an auto re-check.
    setDrug1(d1);
    setDrug2(d2);
    setChecking(true);
    setResult(null);
    setSuggestions1([]);
    setSuggestions2([]);

    try {
      // `@huggingface/tokenizers` `encode` only accepts `{ text_pair, add_special_tokens, return_token_type_ids }`.
      // It does not pad — we pad/truncate to MODEL_SEQ_LEN ourselves.
      const enc = tokenizer.encode(d1, {
        text_pair: d2,
        add_special_tokens: true,
        return_token_type_ids: true,
      }) as {
        ids: number[];
        attention_mask: number[];
        token_type_ids?: number[];
      };

      const padded = padOrTruncateBertTensors(
        enc.ids,
        enc.attention_mask,
        enc.token_type_ids,
        MODEL_SEQ_LEN,
        PAD_TOKEN_ID
      );

      // Use BigInt() constructors (instead of `...n` literals) for broader TS target compatibility.
      const ids   = BigInt64Array.from(padded.ids.map(v => BigInt(v)));
      const mask  = BigInt64Array.from(padded.attention_mask.map(v => BigInt(v)));
      const tids  = BigInt64Array.from(padded.token_type_ids.map(v => BigInt(v)));

      const t0  = performance.now();
      const out = await session.run({
        input_ids:      new ort.Tensor("int64", ids,  [1, MODEL_SEQ_LEN]),
        attention_mask: new ort.Tensor("int64", mask, [1, MODEL_SEQ_LEN]),
        token_type_ids: new ort.Tensor("int64", tids, [1, MODEL_SEQ_LEN]),
      });
      const latencyMs = Math.round(performance.now() - t0);

      const logits = Array.from(out.logits.data as Float32Array);
      // Stable softmax
      const maxLogit = Math.max(...logits);
      const exp    = logits.map(v => Math.exp(v - maxLogit));
      const sum    = exp.reduce((a,b)=>a+b,0);
      const probs  = exp.map(v=>v/sum);
      const idx    = probs.indexOf(Math.max(...probs));
      const severities: Severity[] = ["none","moderate","severe"];
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
      setHistory(h => [r, ...h].slice(0, 50));
    } catch(e) {
      console.error(e);
    }
    setChecking(false);
  }

  // If the user clicks a history item on the `/history` page, we store the drug
  // pair in a ref and trigger an automatic re-run once the model is ready.
  useEffect(() => {
    if (!session) return;
    const pending = pendingAutoCheckRef.current;
    if (!pending) return;
    runCheck(pending.drug1, pending.drug2);
    pendingAutoCheckRef.current = null;
    // runCheck is recreated on render; this effect only needs latest behavior when `session` changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  function swap() {
    setDrug1(drug2);
    setDrug2(drug1);
    setResult(null);
  }

  function clear() {
    setDrug1(""); setDrug2(""); setResult(null);
    setSuggestions1([]); setSuggestions2([]);
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={{minHeight:"100vh", background:"#F8FAFC", fontFamily:"'DM Sans', 'Helvetica Neue', Arial, sans-serif"}}>

      {/* Header */}
      <header style={{background:"#0F2A3F", padding:"0 32px", display:"flex", alignItems:"center", justifyContent:"space-between", height:64}}>
        <div style={{display:"flex", alignItems:"center", gap:12}}>
          <div style={{width:32, height:32, borderRadius:8, background:"#1D9E75", display:"flex", alignItems:"center", justifyContent:"center"}}>
            <span style={{color:"#fff", fontWeight:700, fontSize:16}}>Rx</span>
          </div>
          <div>
            <div style={{color:"#fff", fontWeight:700, fontSize:18, letterSpacing:"-0.3px"}}>ClinicalDDI</div>
            <div style={{color:"#9FE1CB", fontSize:11}}>Drug Interaction Checker</div>
          </div>
        </div>
        <div style={{display:"flex", alignItems:"center", gap:8}}>
          <div style={{
            width:8, height:8, borderRadius:"50%",
            background: modelReady ? "#22C55E" : loadError ? "#F43F5E" : "#F59E0B",
            boxShadow: modelReady ? "0 0 6px #22C55E" : "none"
          }}/>
          <span style={{color:"#9FE1CB", fontSize:13}}>
            {modelReady ? "Model ready — offline" : loadError ? "Load error" : "Loading model..."}
          </span>
        </div>
      </header>

      {/* Research caveat banner */}
      <div style={{
        background:"#FFF7ED", borderBottom:"1px solid #FED7AA",
        padding:"10px 32px", display:"flex", alignItems:"center",
        gap:10, fontSize:13
      }}>
        <div style={{
          width:18, height:18, borderRadius:"50%", background:"#F59E0B",
          display:"flex", alignItems:"center", justifyContent:"center",
          flexShrink:0, color:"#fff", fontWeight:700, fontSize:11
        }}>!</div>
        <span style={{color:"#92400E"}}>
          <strong>Research prototype — active development:</strong> Currently trained on TWOSIDES + curated clinical pairs.
          Target: 1 million drug pairs from DrugBank, TWOSIDES, FAERS and clinical literature.
          Predictions improve as training data grows. Not for clinical use without validation.
        </span>
      </div>

      {/* Nav Tabs */}
      <nav
        style={{
          background:"#fff",
          borderBottom:"1px solid #E2E8F0",
          padding:"0 32px",
          display:"flex",
          gap:0,
          // Ensure nav stays clickable even if an autocomplete dropdown overlays it.
          position:"relative",
          zIndex:50,
        }}
      >
        {(["checker","history","about"] as const).map(t => (
          <button
            key={t}
            onClick={()=>switchTab(t)}
            style={{
            padding:"14px 20px", border:"none", background:"none", cursor:"pointer",
            fontSize:14, fontWeight:600, letterSpacing:"0.2px",
            color: tab===t ? "#0F2A3F" : "#64748B",
            borderBottom: tab===t ? "2px solid #1D9E75" : "2px solid transparent",
            textTransform:"capitalize", transition:"all 0.15s",
          }}
          >
            {t}{t==="history" && history.length>0 ? ` (${history.length})` : ""}
          </button>
        ))}
      </nav>

      <main style={{maxWidth:780, margin:"0 auto", padding:"32px 24px"}}>

        {/* ── CHECKER TAB ── */}
        {tab==="checker" && (
          <div>
            {/* Input card */}
            <div style={{background:"#fff", borderRadius:16, border:"1px solid #E2E8F0", padding:32, marginBottom:20, boxShadow:"0 1px 3px rgba(0,0,0,0.06)"}}>
              <h2 style={{margin:"0 0 6px", fontSize:20, fontWeight:700, color:"#0F2A3F"}}>Check drug interaction</h2>
              <p style={{margin:"0 0 28px", fontSize:14, color:"#64748B"}}>Enter two drug names to check for interactions. Runs 100% offline — no data sent anywhere.</p>

              <div style={{display:"grid", gridTemplateColumns:"1fr auto 1fr", gap:12, alignItems:"start"}}>
                {/* Drug 1 */}
                <div style={{position:"relative"}}>
                  <label style={{display:"block", fontSize:12, fontWeight:600, color:"#475569", marginBottom:6, textTransform:"uppercase", letterSpacing:"0.5px"}}>Drug 1</label>
                  <input
                    ref={inputRef1}
                    value={drug1}
                    onChange={e=>{setDrug1(e.target.value); setSuggestions1(getSuggestions(e.target.value));}}
                    onKeyDown={e=>e.key==="Enter" && drug2 && runCheck()}
                    placeholder="e.g. Aspirin"
                    style={{width:"100%", padding:"12px 14px", fontSize:15, border:"1.5px solid #CBD5E1", borderRadius:10, outline:"none", boxSizing:"border-box", background:"#F8FAFC", color:"#0F2A3F"}}
                  />
                  {suggestions1.length>0 && (
                    <div style={{position:"absolute", top:"100%", left:0, right:0, background:"#fff", border:"1px solid #E2E8F0", borderRadius:8, zIndex:10, boxShadow:"0 4px 12px rgba(0,0,0,0.1)", marginTop:4}}>
                      {suggestions1.map(s=>(
                        <div key={s} onClick={()=>{setDrug1(s); setSuggestions1([]);}}
                          style={{padding:"10px 14px", cursor:"pointer", fontSize:14, color:"#334155", borderBottom:"1px solid #F1F5F9"}}
                          onMouseEnter={e=>(e.currentTarget.style.background="#F8FAFC")}
                          onMouseLeave={e=>(e.currentTarget.style.background="#fff")}>
                          {s}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Swap button */}
                <div style={{paddingTop:28}}>
                  <button onClick={swap} title="Swap drugs" style={{
                    width:42, height:44, borderRadius:10, border:"1.5px solid #CBD5E1",
                    background:"#F8FAFC", cursor:"pointer", fontSize:18, color:"#64748B",
                    display:"flex", alignItems:"center", justifyContent:"center",
                  }}>⇄</button>
                </div>

                {/* Drug 2 */}
                <div style={{position:"relative"}}>
                  <label style={{display:"block", fontSize:12, fontWeight:600, color:"#475569", marginBottom:6, textTransform:"uppercase", letterSpacing:"0.5px"}}>Drug 2</label>
                  <input
                    ref={inputRef2}
                    value={drug2}
                    onChange={e=>{setDrug2(e.target.value); setSuggestions2(getSuggestions(e.target.value));}}
                    onKeyDown={e=>e.key==="Enter" && drug1 && runCheck()}
                    placeholder="e.g. Warfarin"
                    style={{width:"100%", padding:"12px 14px", fontSize:15, border:"1.5px solid #CBD5E1", borderRadius:10, outline:"none", boxSizing:"border-box", background:"#F8FAFC", color:"#0F2A3F"}}
                  />
                  {suggestions2.length>0 && (
                    <div style={{position:"absolute", top:"100%", left:0, right:0, background:"#fff", border:"1px solid #E2E8F0", borderRadius:8, zIndex:10, boxShadow:"0 4px 12px rgba(0,0,0,0.1)", marginTop:4}}>
                      {suggestions2.map(s=>(
                        <div key={s} onClick={()=>{setDrug2(s); setSuggestions2([]);}}
                          style={{padding:"10px 14px", cursor:"pointer", fontSize:14, color:"#334155", borderBottom:"1px solid #F1F5F9"}}
                          onMouseEnter={e=>(e.currentTarget.style.background="#F8FAFC")}
                          onMouseLeave={e=>(e.currentTarget.style.background="#fff")}>
                          {s}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Buttons */}
              <div style={{display:"flex", gap:10, marginTop:20}}>
                <button onClick={() => runCheck()} disabled={checking || !modelReady || !tokenizer || !drug1.trim() || !drug2.trim()} style={{
                  flex:1, padding:"13px", fontSize:15, fontWeight:600,
                  background: (modelReady && tokenizer && drug1 && drug2) ? "#0F2A3F" : "#94A3B8",
                  color:"#fff", border:"none", borderRadius:10, cursor: (modelReady && drug1 && drug2) ? "pointer" : "default",
                  transition:"background 0.2s",
                }}>
                  {checking ? "Checking..." : !modelReady ? "Loading model..." : !tokenizer ? "Loading tokenizer..." : "Check interaction"}
                </button>
                <button onClick={clear} style={{
                  padding:"13px 20px", fontSize:15, fontWeight:600,
                  background:"#F1F5F9", color:"#475569", border:"none", borderRadius:10, cursor:"pointer",
                }}>Clear</button>
              </div>
            </div>

            {/* Result card */}
            {result && (() => {
              const cfg = SEVERITY_CONFIG[result.severity];
              return (
                <div style={{background:cfg.bg, borderRadius:16, border:`1.5px solid ${cfg.border}`, padding:28, marginBottom:20}}>
                  <div style={{display:"flex", alignItems:"flex-start", gap:12, marginBottom:12}}>
                    <div style={{width:14, height:14, borderRadius:"50%", background:cfg.dot, flexShrink:0, marginTop:4}}/>
                    <div style={{flex:1, minWidth:0}}>
                      <div style={{fontSize:20, fontWeight:700, color:cfg.text}}>{cfg.label}</div>
                      {result.probMargin !== undefined && result.normalizedEntropy !== undefined && (
                        <div style={{fontSize:12, color:"#64748B", marginTop:4, lineHeight:1.5}}>
                          Margin vs 2nd: <strong style={{color:"#0F2A3F"}}>+{(result.probMargin * 100).toFixed(1)}%</strong>
                          {" · "}
                          Ambiguity: <strong style={{color:"#0F2A3F"}}>{(result.normalizedEntropy * 100).toFixed(0)}%</strong>
                          <span style={{opacity:0.85}}> (0 = decisive, 100 = uniform)</span>
                        </div>
                      )}
                    </div>
                    <div style={{marginLeft:"auto", textAlign:"right", flexShrink:0}}>
                      <div style={{background:cfg.badge, color:cfg.badgeText, fontSize:12, fontWeight:700, padding:"4px 12px", borderRadius:20}}>
                        Top class {(result.confidence*100).toFixed(1)}%
                      </div>
                    </div>
                  </div>

                  {result.classProbs && (
                    <p style={{margin:"0 0 16px", fontSize:13, color:"#475569", lineHeight:1.6}}>
                      All classes:{" "}
                      <span style={{fontWeight:600, color:SEVERITY_CONFIG.none.text}}>No {(result.classProbs[0]*100).toFixed(1)}%</span>
                      {" · "}
                      <span style={{fontWeight:600, color:SEVERITY_CONFIG.moderate.text}}>Moderate {(result.classProbs[1]*100).toFixed(1)}%</span>
                      {" · "}
                      <span style={{fontWeight:600, color:SEVERITY_CONFIG.severe.text}}>Severe {(result.classProbs[2]*100).toFixed(1)}%</span>
                    </p>
                  )}

                  <div style={{display:"flex", gap:10, flexWrap:"wrap"}}>
                    {[
                      {label:"Drug 1", value:result.drug1},
                      {label:"Drug 2", value:result.drug2},
                      {label:"Inference", value:`${result.latencyMs}ms`},
                      {label:"Mode", value:"Offline · WASM"},
                      {label:"Model", value:"BioBERT-tiny INT8"},
                      {label:"Data sent", value:"None"},
                    ].map(({label,value})=>(
                      <div key={label} style={{background:"rgba(255,255,255,0.7)", borderRadius:8, padding:"8px 14px", fontSize:13}}>
                        <div style={{color:"#64748B", fontSize:11, fontWeight:600, textTransform:"uppercase", letterSpacing:"0.4px", marginBottom:2}}>{label}</div>
                        <div style={{color:"#0F2A3F", fontWeight:600}}>{value}</div>
                      </div>
                    ))}
                  </div>

                  <p style={{margin:"16px 0 0", fontSize:13, color:"#64748B", lineHeight:1.55}}>
                    For clinical decision support only. The model can be wrong: it may miss known interactions or overstate risk. Always cross-check with current prescribing references (e.g. product labels, national formularies) and clinical judgment — especially for high-risk patients.
                  </p>
                </div>
              );
            })()}

            {/* Quick examples */}
            <div style={{background:"#fff", borderRadius:16, border:"1px solid #E2E8F0", padding:24}}>
              <div style={{fontSize:13, fontWeight:600, color:"#475569", marginBottom:14, textTransform:"uppercase", letterSpacing:"0.5px"}}>Quick examples</div>
              <div style={{display:"flex", gap:8, flexWrap:"wrap"}}>
                {[
                  {d1:"Aspirin",d2:"Warfarin",label:"Aspirin + Warfarin"},
                  {d1:"Simvastatin",d2:"Erythromycin",label:"Simvastatin + Erythromycin"},
                  {d1:"MAOIs",d2:"SSRIs",label:"MAOIs + SSRIs"},
                  {d1:"Metformin",d2:"Lisinopril",label:"Metformin + Lisinopril"},
                  {d1:"Warfarin",d2:"Rifampicin",label:"Warfarin + Rifampicin"},
                ].map(({d1,d2,label})=>(
                  <button key={label} onClick={()=>{setDrug1(d1);setDrug2(d2);setResult(null);setSuggestions1([]);setSuggestions2([]);}} style={{
                    padding:"8px 14px", fontSize:13, fontWeight:500,
                    background:"#F1F5F9", color:"#334155", border:"1px solid #E2E8F0",
                    borderRadius:20, cursor:"pointer",
                  }}>{label}</button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── HISTORY TAB ── */}
        {tab==="history" && (
          <div>
            <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20}}>
              <h2 style={{margin:0, fontSize:20, fontWeight:700, color:"#0F2A3F"}}>Check history</h2>
              {history.length>0 && (
                <button onClick={()=>{
                  setHistory([]);
                  if (typeof window !== "undefined") {
                    window.localStorage.removeItem(STORAGE_KEY_HISTORY);
                  }
                }} style={{
                  padding:"8px 16px", fontSize:13, fontWeight:600,
                  background:"#FEF2F2", color:"#991B1B", border:"1px solid #FECACA",
                  borderRadius:8, cursor:"pointer",
                }}>Clear history</button>
              )}
            </div>
            {history.length===0 ? (
              <div style={{textAlign:"center", padding:"60px 0", color:"#94A3B8", fontSize:15}}>
                No checks yet — run your first interaction check
              </div>
            ) : (
              <div style={{display:"flex", flexDirection:"column", gap:10}}>
                {history.map(h => {
                  const cfg = SEVERITY_CONFIG[h.severity];
                  return (
                    <div key={h.id} style={{
                      background:"#fff", borderRadius:12, border:`1px solid ${cfg.border}`,
                      padding:"16px 20px", display:"flex", alignItems:"center", gap:16,
                      cursor:"pointer",
                    }} onClick={()=>{setDrug1(h.drug1);setDrug2(h.drug2);runCheck(h.drug1, h.drug2);setTab("checker");}}>
                      <div style={{width:10, height:10, borderRadius:"50%", background:cfg.dot, flexShrink:0}}/>
                      <div style={{flex:1}}>
                        <div style={{fontSize:15, fontWeight:600, color:"#0F2A3F"}}>{h.drug1} + {h.drug2}</div>
                        <div style={{fontSize:13, color:"#64748B", marginTop:2}}>{cfg.label}</div>
                        {h.classProbs && (
                          <div style={{fontSize:11, color:"#94A3B8", marginTop:4}}>
                            No {(h.classProbs[0]*100).toFixed(0)}% · Mod {(h.classProbs[1]*100).toFixed(0)}% · Sev {(h.classProbs[2]*100).toFixed(0)}%
                            {h.probMargin !== undefined && h.normalizedEntropy !== undefined && (
                              <span> · M +{(h.probMargin*100).toFixed(0)}% · Amb {(h.normalizedEntropy*100).toFixed(0)}%</span>
                            )}
                          </div>
                        )}
                      </div>
                      <div style={{textAlign:"right"}}>
                        <div style={{background:cfg.badge, color:cfg.badgeText, fontSize:12, fontWeight:700, padding:"3px 10px", borderRadius:12, marginBottom:4}}>
                          Top {(h.confidence*100).toFixed(1)}%
                        </div>
                        <div style={{fontSize:11, color:"#94A3B8"}}>{h.latencyMs}ms · {h.timestamp.toLocaleTimeString()}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── ABOUT TAB ── */}
        {tab==="about" && (
          <div style={{display:"flex", flexDirection:"column", gap:16}}>
            <div style={{background:"#fff", borderRadius:16, border:"1px solid #E2E8F0", padding:32}}>
              <h2 style={{margin:"0 0 12px", fontSize:20, fontWeight:700, color:"#0F2A3F"}}>About ClinicalDDI</h2>
              <p style={{margin:"0 0 16px", fontSize:15, color:"#475569", lineHeight:1.7}}>
                ClinicalDDI is a privacy-first drug-drug interaction checker that runs entirely
                in your browser via WebAssembly. No patient data is ever transmitted — inference
                happens locally on your device.
              </p>
              <div style={{
                background:"#F0FDF4", borderRadius:10, border:"1px solid #86EFAC",
                padding:"16px 20px", margin:"0 0 16px"
              }}>
                <div style={{fontSize:14, fontWeight:700, color:"#14532D", marginBottom:8}}>
                  Training roadmap
                </div>
                {[
                  {label:"Current", value:"TWOSIDES 63,000 pairs + curated clinical pairs", done:true},
                  {label:"Next", value:"DrugBank 300,000+ interactions (registration pending)", done:false},
                  {label:"Target", value:"1,000,000+ pairs — DrugBank + TWOSIDES + FAERS + literature", done:false},
                ].map(({label,value,done})=>(
                  <div key={label} style={{
                    display:"flex", gap:10, alignItems:"flex-start",
                    padding:"6px 0", borderBottom:"1px solid #DCFCE7"
                  }}>
                    <div style={{
                      width:16, height:16, borderRadius:"50%", flexShrink:0, marginTop:1,
                      background: done ? "#22C55E" : "#D1D5DB",
                      display:"flex", alignItems:"center", justifyContent:"center",
                    }}>
                      {done && <span style={{color:"#fff", fontSize:10, fontWeight:700}}>✓</span>}
                    </div>
                    <div>
                      <span style={{fontSize:13, fontWeight:700, color:"#14532D"}}>{label}: </span>
                      <span style={{fontSize:13, color:"#475569"}}>{value}</span>
                    </div>
                  </div>
                ))}
              </div>
              <p style={{margin:0, fontSize:15, color:"#475569", lineHeight:1.7}}>
                Built for research centers, laboratories, clinics and hospitals that cannot
                afford to send sensitive patient data to the cloud.
              </p>
            </div>

            {[
              {title:"Model", items:[
                ["Architecture","BioBERT-tiny fine-tuned for DDI classification"],
                ["Classes","No interaction · Moderate · Severe"],
                ["AUROC","0.96 (target was 0.85)"],
                ["Quantisation","INT8 dynamic — torch.quantization"],
                ["Format","ONNX opset 17 → ONNX Runtime Web (WASM)"],
                ["Model size","0.02 MB"],
                ["Inference","~3.4ms avg in browser"],
              ]},
              {title:"Privacy & architecture", items:[
                ["Data transmission","Zero — fully offline"],
                ["Internet required","No"],
                ["Patient data stored","Never"],
                ["Deployment","Static site — Vercel free tier"],
                ["Runtime","WebAssembly (WASM) in browser"],
              ]},
              {title:"Regulatory context", items:[
                ["Classification","Class II SaMD (510k) — clinical decision support"],
                ["PDPA Malaysia","Compliant by design — no data leaves device"],
                ["Use case","Decision support only — not autonomous prescriber"],
                ["Audit trail","AUROC documented · model version tracked"],
              ]},
            ].map(({title,items})=>(
              <div key={title} style={{background:"#fff", borderRadius:16, border:"1px solid #E2E8F0", padding:28}}>
                <h3 style={{margin:"0 0 16px", fontSize:16, fontWeight:700, color:"#0F2A3F", textTransform:"capitalize"}}>{title}</h3>
                <div style={{display:"flex", flexDirection:"column", gap:0}}>
                  {items.map(([k,v],i)=>(
                    <div key={k} style={{
                      display:"flex", justifyContent:"space-between", alignItems:"center",
                      padding:"10px 0", borderBottom: i<items.length-1 ? "1px solid #F1F5F9" : "none",
                      gap:16,
                    }}>
                      <span style={{fontSize:14, color:"#64748B", flexShrink:0}}>{k}</span>
                      <span style={{fontSize:14, fontWeight:600, color:"#0F2A3F", textAlign:"right"}}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer style={{borderTop:"1px solid #E2E8F0", padding:"16px 32px", textAlign:"center", fontSize:12, color:"#94A3B8"}}>
        ClinicalDDI · Research prototype · Training target: 1M drug pairs · For decision support only · Always verify with current drug references
      </footer>
    </div>
  );
}