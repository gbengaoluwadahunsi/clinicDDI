"use client";

import { useState, useEffect, useRef, useMemo, useCallback, type ChangeEvent } from "react";
import type { RDKitModule } from "@rdkit/rdkit";
import {
  Activity,
  Trash2,
  Lock,
  FileText,
  Pill,
  FlaskConical,
  Download,
  Upload,
  Globe,
  AlertTriangle,
  HelpCircle,
} from "lucide-react";
import { db } from "@/lib/db";
import { useLiveQuery } from "dexie-react-hooks";
import { generateCurrentInteractionPdf, generateHistoryPdf } from "@/lib/pdf-generator";
import { lookupDrugMonograph } from "@/lib/drug-lookup";
import { lookupPairExplanation } from "@/lib/pair-explanation-lookup";
import { lookupClinicalReliefPair } from "@/lib/clinical-pair-relief-lookup";
import {
  resolveNameToSmiles,
  allDrugNamesForAutocomplete,
  hydrateDrugSmilesFromPublic,
  warmDrugSmilesCanonicalIndex,
  findDrugNameFromSmiles,
} from "@/lib/drug-smiles-lookup";
import { inferStructureDdi, probsFromStructureResult, setFingerprintBinaryHead } from "@/lib/structure-ddi-inference";
import { useRDKit } from "@/hooks/useRDKit";
import { simpleInteractionHeadline } from "@/lib/ddi-report-labels";
import { useAppToast } from "@/components/ToastProvider";
import type { ClinicalInteractionPdfPayload } from "@/lib/pdf-check-types";
import { buildCombinationExplanationBlocks } from "@/lib/combination-explanation";
import { ResultExplanationModal } from "@/components/ResultExplanationModal";

// ── Types ───────────────────────────────────────────────────────────────────
type Severity = "none" | "moderate" | "severe";
type InputMode = "names" | "smiles";

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
  source: "bert_names" | "structure_fp" | "structure_similarity"; // bert_names = legacy history only
  pairExplanation?: { title: string; text: string } | null;
  smiles1?: string;
  smiles2?: string;
  tanimoto?: number;
  structureNote?: string;
  /** Resolved structures are the same molecule (e.g. aspirin twice). */
  identicalCompoundPair?: boolean;
  /** Offline note replaced the automated score (e.g. aspirin + paracetamol). */
  clinicalReliefPair?: boolean;
}

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

const REPORT_NEUTRAL_STYLE = {
  dot: "#64748B",
} as const;

function checkResultToPdfPayload(r: CheckResult): ClinicalInteractionPdfPayload {
  return {
    drug1: r.drug1,
    drug2: r.drug2,
    severity: r.severity,
    confidence: r.confidence,
    classProbs: r.classProbs,
    source: r.source,
    latencyMs: r.latencyMs,
    checkedAtIso: r.timestamp.toISOString(),
    pairExplanation: r.pairExplanation ?? null,
    smiles1: r.smiles1,
    smiles2: r.smiles2,
    tanimoto: r.tanimoto,
    structureNote: r.structureNote,
    identicalCompoundPair: r.identicalCompoundPair,
    clinicalReliefPair: r.clinicalReliefPair,
  };
}

function entropyBits(probs: number[]): number {
  let h = 0;
  for (const p of probs) {
    if (p > 1e-12) h -= p * Math.log2(p);
  }
  return h;
}

function marginAndAmbiguity(probs: [number, number, number]) {
  const sorted = [...probs].sort((a, b) => b - a);
  const probMargin = sorted[0] - sorted[1];
  const maxH = Math.log2(3);
  const normalizedEntropy = Math.min(1, Math.max(0, entropyBits(probs) / maxH));
  return { probMargin, normalizedEntropy };
}

function filterAutocomplete(query: string, pool: string[], max = 8): string[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const hit = pool.filter((n) => n.toLowerCase().startsWith(q));
  if (hit.length >= max) return hit.slice(0, max);
  const sub = pool.filter((n) => n.toLowerCase().includes(q) && !hit.includes(n));
  return [...hit, ...sub].slice(0, max);
}

type SmilesInputFeedback =
  | { kind: "loading" }
  | { kind: "ok"; displayMedicationName: string | null; viaAppMedicationList: boolean }
  | { kind: "invalid" };

/** Same rules as Run check: valid SMILES, or text that maps to SMILES via the bundled name list. */
function buildSmilesInputFeedback(rdkitModule: RDKitModule | null, raw: string): SmilesInputFeedback | null {
  const t = raw.trim();
  if (!t) return null;
  if (!rdkitModule) return { kind: "loading" };

  const molDirect = rdkitModule.get_mol(t);
  if (molDirect) {
    molDirect.delete();
    const fromStruct = findDrugNameFromSmiles(rdkitModule, t);
    return { kind: "ok", displayMedicationName: fromStruct, viaAppMedicationList: false };
  }

  const mapped = resolveNameToSmiles(t);
  if (mapped) {
    const mol = rdkitModule.get_mol(mapped);
    if (mol) {
      mol.delete();
      const mono = lookupDrugMonograph(t);
      const label = mono?.displayName ?? t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
      return { kind: "ok", displayMedicationName: label, viaAppMedicationList: true };
    }
  }

  return { kind: "invalid" };
}

function monographQueryForField(inputMode: InputMode, drug: string, smilesFeedback: SmilesInputFeedback | null): string {
  if (inputMode === "names") return drug;
  if (!smilesFeedback || smilesFeedback.kind !== "ok") return drug;
  if (smilesFeedback.viaAppMedicationList) return drug.trim();
  if (smilesFeedback.displayMedicationName) return smilesFeedback.displayMedicationName;
  return drug;
}

async function fetchPubChemSmiles(name: string): Promise<string | null> {
  const url = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(name.trim())}/property/IsomericSMILES/JSON`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  return data?.PropertyTable?.Properties?.[0]?.SMILES ?? null;
}

function DrugMonographPanel({
  label,
  query,
  compact,
}: {
  label: string;
  query: string;
  /** Tighter layout + scroll excerpt for one-screen dashboards. */
  compact?: boolean;
}) {
  const info = useMemo(() => lookupDrugMonograph(query), [query]);
  const trimmed = query.trim();
  if (!trimmed) return null;
  return (
    <div
      className={`rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50/80 dark:bg-white/3 text-left ${
        compact ? "p-3" : "p-4"
      }`}
    >
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-brand-600 dark:text-brand-400 mb-2">
        <Pill size={14} className="shrink-0" />
        {label}
        <span className="ml-auto font-normal normal-case text-slate-400">On-device</span>
      </div>
      {info ? (
        <>
          <div className={`font-bold text-navy-950 dark:text-white leading-snug ${compact ? "text-sm" : "text-sm"}`}>
            {info.displayName}
          </div>
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">{info.drugClass}</div>
          <p
            className={`text-slate-600 dark:text-slate-300 mt-2 leading-relaxed ${
              compact ? "text-xs max-h-32 overflow-y-auto pr-1" : "text-sm"
            }`}
          >
            {info.description}
          </p>
        </>
      ) : (
        <p className={`text-slate-500 dark:text-slate-400 ${compact ? "text-xs" : "text-sm"}`}>
          No offline monograph for <span className="font-semibold">“{trimmed}”</span>.
        </p>
      )}
      <p className={`text-slate-400 dark:text-slate-500 mt-3 leading-snug ${compact ? "text-[9px]" : "text-[10px]"}`}>
        Educational only — not medical advice.
      </p>
    </div>
  );
}

function CompoundFieldCard({
  compoundIndex,
  roleTitle,
  inputMode,
  value,
  onChange,
  suggestions,
  datalistId,
  dictionarySmilesLine,
  smilesFeedback,
  monographQuery,
  onPubChem,
  pubChemDisabled,
  pubChemTitle,
  compact = false,
  showReferenceMonograph = true,
}: {
  compoundIndex: 1 | 2;
  roleTitle: string;
  inputMode: InputMode;
  value: string;
  onChange: (next: string) => void;
  suggestions: string[];
  datalistId: string;
  dictionarySmilesLine: string | null;
  smilesFeedback: SmilesInputFeedback | null;
  monographQuery: string;
  onPubChem: () => void;
  pubChemDisabled: boolean;
  pubChemTitle: string;
  compact?: boolean;
  showReferenceMonograph?: boolean;
}) {
  const inputClass =
    "w-full px-4 py-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl text-navy-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all";

  const inputClassCompact =
    "w-full px-3 py-2.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-navy-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all";

  return (
    <div
      className={`rounded-2xl border border-slate-200/90 dark:border-white/10 bg-white/70 dark:bg-navy-900/35 shadow-md shadow-slate-200/40 dark:shadow-none ring-1 ring-slate-200/60 dark:ring-white/5 ${
        compact ? "p-3 sm:p-4 space-y-2" : "p-5 sm:p-6 space-y-4"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className={`flex items-center gap-2 ${compact ? "mb-0.5" : "mb-1"}`}>
            <span
              className={`flex shrink-0 items-center justify-center rounded-full bg-brand-600 font-extrabold text-white ${
                compact ? "h-6 w-6 text-[10px]" : "h-7 w-7 text-xs"
              }`}
            >
              {compoundIndex}
            </span>
            <span
              className={`font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400 ${
                compact ? "text-[10px]" : "text-xs"
              }`}
            >
              Compound {compoundIndex}
            </span>
          </div>
          <h3 className={`font-bold text-navy-950 dark:text-white leading-tight ${compact ? "text-sm" : "text-lg"}`}>
            {roleTitle}
          </h3>
          {!compact ? (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {inputMode === "names"
                ? "Type or pick a medication name, then edit freely."
                : "Paste a structure code (SMILES), or type a medication name if it is in this app’s built-in list."}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onPubChem}
          disabled={pubChemDisabled}
          title={pubChemTitle}
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border-2 border-brand-500/30 bg-brand-50 font-bold text-brand-700 shadow-sm transition hover:bg-brand-100 disabled:pointer-events-none disabled:opacity-40 dark:border-brand-500/40 dark:bg-brand-500/15 dark:text-brand-200 dark:hover:bg-brand-500/25 ${
            compact ? "px-2.5 py-1.5 text-[10px]" : "gap-2 rounded-xl px-3.5 py-2.5 text-xs"
          }`}
        >
          <Globe size={compact ? 14 : 16} className="shrink-0" aria-hidden />
          PubChem
        </button>
      </div>

      <div className="space-y-2">
        <label className="sr-only" htmlFor={`compound-${compoundIndex}-field`}>
          {roleTitle} — {inputMode === "names" ? "medication name" : "SMILES or recognized name"}
        </label>
        {inputMode === "names" ? (
          <>
            <input
              id={`compound-${compoundIndex}-field`}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder="Medication name"
              list={datalistId}
              className={
                compact
                  ? `${inputClassCompact} text-base font-medium font-outfit`
                  : `${inputClass} text-lg font-medium font-outfit`
              }
            />
            <datalist id={datalistId}>
              {suggestions.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </>
        ) : (
          <textarea
            id={`compound-${compoundIndex}-field`}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="SMILES or name from app list"
            rows={compact ? 2 : 4}
            spellCheck={false}
            className={`${
              compact ? `${inputClassCompact} min-h-16 resize-y font-mono text-xs` : `${inputClass} min-h-28 resize-y font-mono text-sm`
            } leading-relaxed`}
          />
        )}
      </div>

      {dictionarySmilesLine ? (
        compact ? (
          <details className="rounded-lg border border-slate-200/80 dark:border-white/10 bg-slate-50/90 dark:bg-white/4 px-2 py-1.5">
            <summary className="cursor-pointer text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 select-none">
              Structure code in app
            </summary>
            <div className="font-mono text-[10px] text-slate-700 dark:text-slate-300 break-all leading-relaxed mt-1 pt-1 border-t border-slate-200/60 dark:border-white/10">
              {dictionarySmilesLine}
            </div>
          </details>
        ) : (
          <div className="rounded-xl border border-slate-200/80 dark:border-white/10 bg-slate-50/90 dark:bg-white/4 px-3 py-2">
            <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">
              Structure from app dictionary
            </div>
            <div className="font-mono text-xs text-slate-700 dark:text-slate-300 break-all leading-relaxed">{dictionarySmilesLine}</div>
          </div>
        )
      ) : null}

      {inputMode === "smiles" && value.trim() ? (
        <div
          className={`rounded-xl border border-slate-200/80 dark:border-white/10 bg-slate-50/90 dark:bg-white/4 ${
            compact ? "px-2 py-1.5" : "px-3 py-2"
          }`}
        >
          {!smilesFeedback || smilesFeedback.kind === "loading" ? (
            <p className={`text-slate-600 dark:text-slate-400 ${compact ? "text-xs" : "text-sm"}`}>
              Checking your medication or structure…
            </p>
          ) : smilesFeedback.kind === "invalid" ? (
            <p className={`text-amber-900 dark:text-amber-100 leading-relaxed ${compact ? "text-xs" : "text-sm"}`}>
              We couldn&apos;t use this text. For medication names, use the <strong>Drug names</strong> tab, or paste a valid SMILES
              string.
            </p>
          ) : smilesFeedback.viaAppMedicationList ? (
            <div className={`text-navy-950 dark:text-white leading-relaxed ${compact ? "text-xs" : "text-sm"}`}>
              <p>
                <span className="font-bold text-emerald-700 dark:text-emerald-300">Recognized: </span>
                {smilesFeedback.displayMedicationName ?? value.trim()}
              </p>
              {!compact ? (
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">
                  Tip: the <strong>Drug names</strong> tab is usually easier when you are typing names.
                </p>
              ) : null}
            </div>
          ) : smilesFeedback.displayMedicationName ? (
            <p className={`text-navy-950 dark:text-white ${compact ? "text-xs" : "text-sm"}`}>
              <span className="font-bold text-brand-600 dark:text-brand-400">Matched: </span>
              {smilesFeedback.displayMedicationName}
            </p>
          ) : (
            <p className={`text-slate-600 dark:text-slate-400 ${compact ? "text-xs" : "text-sm"}`}>
              Valid structure; no bundled name match.
            </p>
          )}
        </div>
      ) : null}

      {showReferenceMonograph ? <DrugMonographPanel label={`${roleTitle} — reference`} query={monographQuery} /> : null}
    </div>
  );
}

function exportHistoryCsv(rows: { drug1: string; drug2: string; severity: string; confidence: number; timestamp: number; source?: string; tanimoto?: number }[]) {
  const esc = (s: string) => `"${String(s).replace(/"/g, '""')}"`;
  const header = ["timestamp", "drug1", "drug2", "severity", "confidence", "source", "tanimoto"];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [
        new Date(r.timestamp).toISOString(),
        esc(r.drug1),
        esc(r.drug2),
        r.severity,
        r.confidence.toFixed(4),
        r.source ?? "",
        r.tanimoto != null ? r.tanimoto.toFixed(4) : "",
      ].join(",")
    );
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `clinicalddi-history-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ClinicalDDIClient() {
  const { rdkit: rdkitModule, loading: rdkitLoading, error: rdkitError } = useRDKit();
  const { toast, success, error: toastError, dismiss } = useAppToast();
  const [inputMode, setInputMode] = useState<InputMode>("names");
  const [drug1, setDrug1] = useState("");
  const [drug2, setDrug2] = useState("");
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [manifestVer, setManifestVer] = useState<string | null>(null);
  const [smilesDictVersion, setSmilesDictVersion] = useState(0);
  const [remoteRelease, setRemoteRelease] = useState<string | null>(null);
  const batchInputRef = useRef<HTMLInputElement>(null);
  const NAME_POOL = useMemo(() => allDrugNamesForAutocomplete(), [smilesDictVersion]);

  const suggestions1 = useMemo(() => filterAutocomplete(drug1, NAME_POOL), [drug1, NAME_POOL]);
  const suggestions2 = useMemo(() => filterAutocomplete(drug2, NAME_POOL), [drug2, NAME_POOL]);

  const dictSmiles1 = useMemo(
    () => (inputMode === "names" && drug1.trim() ? resolveNameToSmiles(drug1) : null),
    [inputMode, drug1, smilesDictVersion]
  );
  const dictSmiles2 = useMemo(
    () => (inputMode === "names" && drug2.trim() ? resolveNameToSmiles(drug2) : null),
    [inputMode, drug2, smilesDictVersion]
  );

  const smilesFeedback1 = useMemo(
    () => (inputMode === "smiles" ? buildSmilesInputFeedback(rdkitModule, drug1) : null),
    [inputMode, drug1, rdkitModule, smilesDictVersion]
  );
  const smilesFeedback2 = useMemo(
    () => (inputMode === "smiles" ? buildSmilesInputFeedback(rdkitModule, drug2) : null),
    [inputMode, drug2, rdkitModule, smilesDictVersion]
  );

  const monographQuery1 = useMemo(
    () => monographQueryForField(inputMode, drug1, smilesFeedback1),
    [inputMode, drug1, smilesFeedback1]
  );
  const monographQuery2 = useMemo(
    () => monographQueryForField(inputMode, drug2, smilesFeedback2),
    [inputMode, drug2, smilesFeedback2]
  );

  const pubChemTitle =
    inputMode !== "names"
      ? "Switch to “Drug names” to query PubChem using a medication name."
      : "Looks up SMILES from NIH PubChem (sends the medication name over the internet).";

  const localHistory = useLiveQuery(() => db.history.orderBy("timestamp").reverse().limit(200).toArray()) || [];

  const [explainOpen, setExplainOpen] = useState(false);

  const explanationPayload = useMemo(() => (result ? checkResultToPdfPayload(result) : null), [result]);
  const explanationBlocks = useMemo(
    () => (explanationPayload ? buildCombinationExplanationBlocks(explanationPayload) : []),
    [explanationPayload]
  );

  const exportCurrentInteractionPdfFromResult = useCallback(() => {
    if (!result) return;
    generateCurrentInteractionPdf(checkResultToPdfPayload(result));
  }, [result]);


  useEffect(() => {
    void hydrateDrugSmilesFromPublic().then(() => setSmilesDictVersion((v) => v + 1));
  }, []);

  useEffect(() => {
    if (!rdkitModule) return;
    try {
      warmDrugSmilesCanonicalIndex(rdkitModule);
    } catch {
      /* ignore warm failures */
    }
  }, [rdkitModule, smilesDictVersion]);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/model-manifest.json");
        const j = await r.json();
        setManifestVer(j.appVersion ?? null);
        const head = j.fingerprintOnnx?.singleOutput as string | undefined;
        setFingerprintBinaryHead(head === "probability" ? "probability" : "logit");
      } catch {
        setManifestVer(null);
      }
    })();
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("https://api.github.com/repos/gbengaoluwadahunsi/clinicDDI/releases/latest");
        if (!r.ok) return;
        const j = await r.json();
        if (!cancelled && j.tag_name) setRemoteRelease(j.tag_name as string);
      } catch {
        /* optional */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const persistResult = useCallback(async (r: CheckResult) => {
    await db.history.add({
      drug1: r.drug1,
      drug2: r.drug2,
      severity: r.severity,
      confidence: r.confidence,
      classProbs: r.classProbs,
      latencyMs: r.latencyMs,
      timestamp: r.timestamp.getTime(),
      source: r.source,
      tanimoto: r.tanimoto,
    });
  }, []);

  const runCheck = useCallback(
    async (overrideD1?: string, overrideD2?: string) => {
      const d1 = (overrideD1 ?? drug1).trim();
      const d2 = (overrideD2 ?? drug2).trim();
      if (!d1 || !d2) return;

      if (!rdkitModule) {
        toastError("RDKit is still loading. Try again in a moment.");
        return;
      }
      setDrug1(d1);
      setDrug2(d2);
      setChecking(true);
      setExplainOpen(false);
      setResult(null);
      try {
        const resolve = async (raw: string) => {
          const t = raw.trim();
          const mapped = resolveNameToSmiles(t);
          const candidate = mapped ?? t;
          const mol = rdkitModule.get_mol(candidate);
          if (!mol) return null;
          const smiles = mol.get_smiles();
          mol.delete();
          return { smiles, label: t };
        };

        const ra = await resolve(d1);
        const rb = await resolve(d2);
        if (!ra || !rb) {
          toastError(
            "One or both entries could not be used. Check spelling, try the other input tab, add names to your drug list file, or paste a structure from PubChem."
          );
          setChecking(false);
          return;
        }

        if (ra.smiles === rb.smiles) {
          const r: CheckResult = {
            id: crypto.randomUUID(),
            drug1: ra.label,
            drug2: rb.label,
            severity: "none",
            confidence: 1,
            latencyMs: 0,
            timestamp: new Date(),
            source: "structure_fp",
            pairExplanation: null,
            smiles1: ra.smiles,
            smiles2: rb.smiles,
            tanimoto: 1,
            identicalCompoundPair: true,
          };
          setResult(r);
          await persistResult(r);
          setChecking(false);
          return;
        }

        const clinicalRelief = lookupClinicalReliefPair(ra.label, rb.label);
        if (clinicalRelief) {
          const r: CheckResult = {
            id: crypto.randomUUID(),
            drug1: ra.label,
            drug2: rb.label,
            severity: "none",
            confidence: 1,
            latencyMs: 0,
            timestamp: new Date(),
            source: "structure_fp",
            pairExplanation: clinicalRelief,
            smiles1: ra.smiles,
            smiles2: rb.smiles,
            clinicalReliefPair: true,
          };
          setResult(r);
          await persistResult(r);
          setChecking(false);
          return;
        }

        const sres = await inferStructureDdi(rdkitModule, ra.smiles, rb.smiles);
        const expl = lookupPairExplanation(ra.label, rb.label);

        if (sres.kind === "similarity_only") {
          const r: CheckResult = {
            id: crypto.randomUUID(),
            drug1: ra.label,
            drug2: rb.label,
            severity: "none",
            confidence: 0,
            latencyMs: 0,
            timestamp: new Date(),
            source: "structure_similarity",
            pairExplanation: expl,
            smiles1: sres.smiles1,
            smiles2: sres.smiles2,
            tanimoto: sres.tanimoto,
            structureNote: sres.message,
          };
          setResult(r);
          await persistResult(r);
          setChecking(false);
          return;
        }

        const probs3 = probsFromStructureResult(sres);
        if (!probs3) {
          const r: CheckResult = {
            id: crypto.randomUUID(),
            drug1: ra.label,
            drug2: rb.label,
            severity: "none",
            confidence: 0,
            latencyMs: sres.latencyMs,
            timestamp: new Date(),
            source: "structure_fp",
            pairExplanation: expl,
            smiles1: sres.smiles1,
            smiles2: sres.smiles2,
            tanimoto: sres.tanimoto,
            structureNote: "Fingerprint model returned unexpected outputs.",
          };
          setResult(r);
          await persistResult(r);
          setChecking(false);
          return;
        }

        const idx = probs3.indexOf(Math.max(...probs3));
        const severities: Severity[] = ["none", "moderate", "severe"];
        const { probMargin, normalizedEntropy } = marginAndAmbiguity(probs3);
        const maxP = probs3[idx];

        const r: CheckResult = {
          id: crypto.randomUUID(),
          drug1: ra.label,
          drug2: rb.label,
          severity: severities[idx],
          confidence: maxP,
          classProbs: probs3,
          probMargin,
          normalizedEntropy,
          latencyMs: sres.latencyMs,
          timestamp: new Date(),
          source: "structure_fp",
          pairExplanation: expl,
          smiles1: sres.smiles1,
          smiles2: sres.smiles2,
          tanimoto: sres.tanimoto,
        };
        setResult(r);
        await persistResult(r);
      } catch (e) {
        console.error(e);
      }
      setChecking(false);
    },
    [drug1, drug2, persistResult, rdkitModule, toastError]
  );

  function swap() {
    setDrug1(drug2);
    setDrug2(drug1);
    setExplainOpen(false);
    setResult(null);
  }

  function clear() {
    setDrug1("");
    setDrug2("");
    setExplainOpen(false);
    setResult(null);
  }

  async function runPubChemLookup(which: 1 | 2, name: string) {
    toast("Looking up PubChem…", { description: name, duration: Number.POSITIVE_INFINITY });
    try {
      const smi = await fetchPubChemSmiles(name);
      dismiss();
      if (!smi) {
        toastError("No SMILES returned from PubChem.");
        return;
      }
      if (which === 1) setDrug1(smi);
      else setDrug2(smi);
      setInputMode("smiles");
      success("Structure loaded from PubChem.", { description: "Switched to SMILES mode with the structure in this compound’s field." });
    } catch {
      dismiss();
      toastError("PubChem request failed.");
    }
  }

  async function onPubChem(which: 1 | 2) {
    const name = which === 1 ? drug1 : drug2;
    if (!name.trim()) {
      toastError("Type a drug name first.");
      return;
    }
    toast("PubChem lookup", {
      description: "This sends the drug name over the internet to NIH. Continue?",
      action: {
        label: "Continue",
        onClick: () => runPubChemLookup(which, name.trim()),
      },
      cancel: { label: "Cancel" },
    });
  }

  async function onBatchFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length === 0) return;
    const start = /^drug1|^compound|^a/i.test(lines[0]) ? 1 : 0;
    for (let i = start; i < lines.length; i++) {
      const parts = lines[i].split(/[,\t]/).map((s) => s.trim().replace(/^"|"$/g, ""));
      const a = parts[0];
      const b = parts[1];
      if (!a || !b) continue;
      setDrug1(a);
      setDrug2(b);
      await runCheck(a, b);
      await new Promise((r) => setTimeout(r, 40));
    }
  }

  const disabledRun =
    checking || !drug1.trim() || !drug2.trim() || !rdkitModule || rdkitLoading || !!rdkitError;

  return (
    <main className="mx-auto w-full max-w-[1400px] px-4 py-5 sm:px-5 sm:py-6">
      {manifestVer && remoteRelease && remoteRelease.replace(/^v/i, "") !== manifestVer.replace(/^v/i, "") ? (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 px-4 py-3 text-sm text-amber-900 dark:text-amber-200 flex items-start gap-2">
          <AlertTriangle size={18} className="shrink-0 mt-0.5" />
          <div>
            New release <span className="font-bold">{remoteRelease}</span> on GitHub (this build reports{" "}
            <span className="font-mono">{manifestVer}</span>). Updating is optional and user-controlled.
          </div>
        </div>
      ) : null}

      <div className="mb-4 flex justify-center">
        <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-emerald-600 backdrop-blur-md dark:text-emerald-400 sm:text-xs">
          <Lock size={12} className="h-3.5 w-3.5 shrink-0 animate-pulse sm:h-4 sm:w-4" />
          <span className="leading-tight">Private on device · No scoring on our servers</span>
        </div>
      </div>

      <div className="mb-5 text-center animate-slide-up sm:mb-4">
        <h1 className="font-outfit text-2xl font-extrabold tracking-tight text-navy-950 dark:text-white sm:text-3xl">
          Drug interaction intelligence
        </h1>
        <p className="mx-auto mt-1 max-w-2xl text-sm leading-snug text-slate-600 dark:text-slate-400 sm:text-base">
          Two medications, one screen—results stay visible beside the inputs on wide layouts.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)] lg:items-start lg:gap-5">
        <div className="min-w-0">
          <div className="glass animate-slide-up rounded-2xl p-4 shadow-lg shadow-slate-200/40 dark:shadow-none sm:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-xl font-bold text-navy-950 dark:text-white">
                <Activity className="size-5 shrink-0 text-brand-500" /> Interaction check
              </h2>
              <div className="flex items-center gap-2 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold dark:bg-white/5">
                <div
                  className={`h-1.5 w-1.5 rounded-full shadow-[0_0_6px] ${
                    rdkitError
                      ? "bg-red-500 shadow-red-500"
                      : rdkitModule
                        ? "bg-green-500 shadow-green-500"
                        : "animate-pulse bg-amber-500"
                  }`}
                />
                <span className="text-slate-600 dark:text-slate-300">
                  {rdkitError ? "Engine error" : rdkitModule ? "Ready" : "Starting…"}
                </span>
              </div>
            </div>

            <div className="mb-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setInputMode("names");
                  setExplainOpen(false);
                  setResult(null);
                }}
                className={`rounded-xl px-3 py-2 text-xs font-bold transition-all sm:px-4 ${inputMode === "names" ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300"}`}
              >
                Drug names
              </button>
              <button
                type="button"
                onClick={() => {
                  setInputMode("smiles");
                  setExplainOpen(false);
                  setResult(null);
                }}
                className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition-all sm:px-4 ${inputMode === "smiles" ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300"}`}
              >
                <FlaskConical size={14} /> SMILES
              </button>
            </div>

            {rdkitError ? (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200">
                {rdkitError}
              </div>
            ) : null}

            <details className="group mb-4 rounded-xl border border-slate-200/80 bg-slate-50/80 px-3 py-2 dark:border-white/10 dark:bg-white/5">
              <summary className="cursor-pointer list-none text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 [&::-webkit-details-marker]:hidden">
                <span className="flex items-center gap-1">
                  <Upload size={12} className="inline" /> Batch CSV (optional)
                  <span className="ml-1 font-normal normal-case text-slate-400 group-open:hidden">— expand</span>
                </span>
              </summary>
              <div className="mt-2 border-t border-slate-200/80 pt-2 dark:border-white/10">
                <input
                  ref={batchInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="w-full max-w-xs text-[11px]"
                  onChange={onBatchFile}
                />
                <p className="mt-1 text-[10px] leading-snug text-slate-500 dark:text-slate-400">
                  Two columns per line. Each row runs a check automatically.
                </p>
              </div>
            </details>

            <div className="flex flex-col gap-3 md:flex-row md:items-stretch md:gap-2">
              <div className="min-w-0 flex-1">
                <CompoundFieldCard
                  compoundIndex={1}
                  roleTitle="Primary medication"
                  inputMode={inputMode}
                  value={drug1}
                  onChange={setDrug1}
                  suggestions={suggestions1}
                  datalistId="drug-ac-1"
                  dictionarySmilesLine={dictSmiles1}
                  smilesFeedback={smilesFeedback1}
                  monographQuery={monographQuery1}
                  onPubChem={() => onPubChem(1)}
                  pubChemDisabled={inputMode !== "names"}
                  pubChemTitle={pubChemTitle}
                  compact
                  showReferenceMonograph={false}
                />
              </div>

              <div className="flex justify-center md:w-11 md:shrink-0 md:flex-col md:items-center md:pt-10">
                <button
                  type="button"
                  onClick={swap}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 shadow-sm transition hover:text-brand-500 dark:border-white/10 dark:bg-navy-800"
                  title="Swap compounds"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M7 10v12" />
                    <path d="M15 14v8" />
                    <path d="M11 14l4-4 4 4" />
                    <path d="M3 14l4-4 4 4" />
                  </svg>
                </button>
              </div>

              <div className="min-w-0 flex-1">
                <CompoundFieldCard
                  compoundIndex={2}
                  roleTitle="Secondary medication"
                  inputMode={inputMode}
                  value={drug2}
                  onChange={setDrug2}
                  suggestions={suggestions2}
                  datalistId="drug-ac-2"
                  dictionarySmilesLine={dictSmiles2}
                  smilesFeedback={smilesFeedback2}
                  monographQuery={monographQuery2}
                  onPubChem={() => onPubChem(2)}
                  pubChemDisabled={inputMode !== "names"}
                  pubChemTitle={pubChemTitle}
                  compact
                  showReferenceMonograph={false}
                />
              </div>
            </div>

            <details className="mt-3 rounded-lg border border-violet-200/80 bg-violet-50/50 px-2 py-1.5 dark:border-violet-900/40 dark:bg-violet-950/20">
              <summary className="cursor-pointer text-[11px] font-semibold text-violet-900 dark:text-violet-200">
                How “Run check” works
              </summary>
              <p className="mt-1 text-[11px] leading-relaxed text-violet-900/90 dark:text-violet-200/90">
                Names map to structures on your device; a local model estimates interaction strength. Informational only—not a
                diagnosis.
              </p>
            </details>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => runCheck()}
                disabled={disabledRun}
                className="min-h-11 flex-1 rounded-xl bg-brand-600 py-3 font-bold text-white shadow-md transition hover:bg-brand-500 disabled:bg-slate-300 active:scale-[0.99] dark:disabled:bg-slate-600"
              >
                {checking ? "Analyzing…" : "Run check"}
              </button>
              <button
                type="button"
                onClick={clear}
                className="min-h-11 rounded-xl bg-slate-100 px-6 py-3 font-bold text-slate-600 dark:bg-white/5 dark:text-slate-300"
              >
                Clear
              </button>
            </div>
          </div>
        </div>

        <div className="min-w-0 space-y-4 lg:sticky lg:top-20 lg:max-h-[calc(100dvh-5rem)] lg:overflow-y-auto lg:self-start lg:pr-1">
          {result ? (
            (() => {
              const headline = simpleInteractionHeadline({
                severity: result.severity,
                source: result.source,
                structureNote: result.structureNote,
                identicalCompoundPair: result.identicalCompoundPair,
              });
              const neutralReport =
                result.identicalCompoundPair ||
                result.source === "structure_similarity" ||
                !!(result.structureNote && result.source === "structure_fp");
              const cfg = neutralReport ? REPORT_NEUTRAL_STYLE : SEVERITY_CONFIG[result.severity];
              return (
                <div className="glass animate-fade-in rounded-2xl border-t-8 p-4 shadow-xl sm:p-5" style={{ borderTopColor: cfg.dot }}>
                  <div className="mb-4">
                    <div className="mb-1 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Result</div>
                    <div
                      className={`text-xl font-extrabold sm:text-2xl ${neutralReport ? "text-slate-600 dark:text-slate-300" : ""}`}
                      style={neutralReport ? undefined : { color: SEVERITY_CONFIG[result.severity].text }}
                    >
                      {headline}
                    </div>
                    <button
                      type="button"
                      onClick={() => setExplainOpen(true)}
                      className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-brand-200 bg-brand-50 py-2.5 text-sm font-bold text-brand-800 transition hover:bg-brand-100 dark:border-brand-500/35 dark:bg-brand-500/15 dark:text-brand-100 dark:hover:bg-brand-500/25"
                    >
                      <HelpCircle className="size-[18px] shrink-0" aria-hidden />
                      Why this result?
                    </button>
                  </div>

                  <div className="mb-4 space-y-3">
                    <div className="space-y-2">
                      <div className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Compounds</div>
                      {result.identicalCompoundPair ? (
                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-2 leading-relaxed">
                          Both entries resolved to the same structure, so this is one medication entered twice—not two different drugs to compare.
                        </p>
                      ) : null}
                      {result.identicalCompoundPair ? (
                        <DrugMonographPanel label="Medication" query={result.drug1} compact />
                      ) : (
                        <>
                          <DrugMonographPanel label="Primary" query={result.drug1} compact />
                          <DrugMonographPanel label="Secondary" query={result.drug2} compact />
                        </>
                      )}
                    </div>
                  </div>

                  {result.clinicalReliefPair && result.pairExplanation ? (
                    <div className="mb-4 rounded-2xl border border-emerald-200/80 bg-emerald-50/80 p-3 text-sm dark:border-emerald-900/40 dark:bg-emerald-950/25 dark:text-slate-200">
                      <div className="text-xs font-bold uppercase tracking-wide text-emerald-800 dark:text-emerald-300 mb-2">
                        Common guidance for this pair
                      </div>
                      <div className="font-semibold text-navy-950 dark:text-white mb-1">{result.pairExplanation.title}</div>
                      <p className="leading-relaxed text-slate-700 dark:text-slate-300">{result.pairExplanation.text}</p>
                    </div>
                  ) : null}

                  <div className="flex flex-col gap-3">
                    <button
                      type="button"
                      onClick={exportCurrentInteractionPdfFromResult}
                      disabled={!result}
                      title={!result ? "Run a check first" : "Download PDF for this pair only"}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-linear-to-r from-brand-600 to-brand-500 py-3 text-sm font-bold text-white shadow-lg shadow-brand-500/25 transition-all disabled:pointer-events-none disabled:opacity-45"
                    >
                      <FileText size={16} /> Clinical PDF
                    </button>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => generateHistoryPdf(localHistory)}
                        disabled={localHistory.length === 0}
                        title={
                          localHistory.length === 0
                            ? "No saved checks yet"
                            : "PDF for all checks in sidebar history (same as History page)"
                        }
                        className="flex-1 flex items-center justify-center gap-2 py-3 bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-all disabled:opacity-45 disabled:pointer-events-none"
                      >
                        <FileText size={14} /> History PDF
                      </button>
                      <button
                        type="button"
                        onClick={() => exportHistoryCsv(localHistory)}
                        className="flex-1 flex items-center justify-center gap-2 py-3 bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-all"
                      >
                        <Download size={14} /> CSV
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          toast("Clear all saved checks?", {
                            description: "This cannot be undone.",
                            action: {
                              label: "Clear",
                              onClick: () => {
                                void (async () => {
                                  await db.history.clear();
                                  setExplainOpen(false);
                                  setResult(null);
                                  success("History cleared.");
                                })();
                              },
                            },
                            cancel: { label: "Keep" },
                          });
                        }}
                        className="px-4 py-3 bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400 rounded-xl transition-all"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()
          ) : (
            <div className="glass flex min-h-[200px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 p-6 text-center animate-slide-up dark:border-slate-600">
              <Lock size={28} className="mb-4 text-slate-300" />
              <h3 className="mb-2 text-lg font-bold">Awaiting check</h3>
              <p className="text-sm text-slate-500">Run a name or structure check to see the report.</p>
            </div>
          )}
        </div>
      </div>

      {result ? (
        <ResultExplanationModal
          open={explainOpen}
          onClose={() => setExplainOpen(false)}
          headline={simpleInteractionHeadline({
            severity: result.severity,
            source: result.source,
            structureNote: result.structureNote,
            identicalCompoundPair: result.identicalCompoundPair,
          })}
          drugPairLabel={`${result.drug1} + ${result.drug2}`}
          blocks={explanationBlocks}
          onExportPdf={exportCurrentInteractionPdfFromResult}
        />
      ) : null}
    </main>
  );
}
