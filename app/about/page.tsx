import { ShieldCheck, Server, Database, CheckCircle, Verified } from "lucide-react";

export default function AboutPage() {
  return (
    <main className="w-full max-w-4xl mx-auto px-6 py-12">
      <div className="text-center mb-16 animate-slide-up">
        <h1 className="text-4xl md:text-5xl font-outfit font-extrabold tracking-tight text-navy-950 dark:text-white mb-6">
          Architected for <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-600 to-brand-400">Security</span> & <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-600 to-brand-400">Scale</span>
        </h1>
        <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
          ClinicalDDI is a privacy-first drug interaction assistant: inference runs in your browser, with optional sign-in only for convenience—not for paywalls.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-8 mb-16">
        <div className="glass rounded-3xl p-8 animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <div className="w-12 h-12 rounded-xl bg-brand-50 dark:bg-brand-900/40 text-brand-600 dark:text-brand-400 flex items-center justify-center mb-6">
            <Server size={24} />
          </div>
          <h2 className="text-xl font-bold text-navy-950 dark:text-white mb-4">Edge AI inference</h2>
          <p className="text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
            Interaction estimates run on your machine with WebAssembly tooling and a compact ONNX scorer. Requests you type are
            resolved to structures locally when possible—we do not send your drug pairs to ClinicalDDI servers for scoring.
          </p>
          <ul className="space-y-3">
            {[
              "Structure pathway: lookups + fingerprints + ONNX classifier in-browser",
              "Keeps pairing work on-device whenever the bundled resources cover your inputs",
              "Works offline after the app and models finish their first download",
            ].map(item => (
              <li key={item} className="flex gap-3 text-sm font-semibold text-navy-800 dark:text-slate-300">
                <CheckCircle size={18} className="text-brand-500 shrink-0" /> {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="glass rounded-3xl p-8 animate-slide-up" style={{ animationDelay: '0.2s' }}>
          <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-6">
            <Database size={24} />
          </div>
          <h2 className="text-xl font-bold text-navy-950 dark:text-white mb-4">Local history</h2>
          <p className="text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
            Checks and backups stay in your browser by default—nothing uploads for model inference. Optional sign-in can arrive
            later for account features without changing how the scorer runs locally.
          </p>
          <ul className="space-y-3">
            {[
              "History list, full-history PDF export, and per-check PDFs",
              "No subscription or mandatory cloud account",
              "Same bundled browser scorer for everyone who loads the site",
            ].map(item => (
              <li key={item} className="flex gap-3 text-sm font-semibold text-navy-800 dark:text-slate-300">
                <CheckCircle size={18} className="text-amber-500 shrink-0" /> {item}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="glass rounded-3xl p-10 animate-slide-up" style={{ animationDelay: '0.3s' }}>
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-8">
          <div>
            <h2 className="text-2xl font-bold text-navy-950 dark:text-white mb-2 flex items-center gap-3">
              <Verified className="text-brand-500 shrink-0" /> Product roadmap
            </h2>
            <p className="text-slate-600 dark:text-slate-400">
              Earlier releases experimented with BioBERT-style name models. ClinicalDDI Free now ships the{" "}
              <span className="font-semibold text-slate-700 dark:text-slate-300">browser structure pathway only</span>—drug names
              and SMILES resolved on-device into fingerprints, scored by the bundled ONNX model. All rollout phases below are{" "}
              <span className="font-semibold text-slate-700 dark:text-slate-300">complete for this milestone</span>; future work
              is maintenance and refinement, not a blocked roadmap.
            </p>
          </div>
          <div className="px-4 py-3 bg-slate-100 dark:bg-navy-800 text-slate-700 dark:text-slate-300 rounded-xl font-semibold text-sm max-w-[220px] leading-snug shrink-0">
            Scores are <span className="text-brand-600 dark:text-brand-400">informational tools</span>—confirm with prescribing
            information or a clinician.
          </div>
        </div>

        <div className="space-y-4">
          {[
            {
              label: "Phase I — Data & labeling foundations",
              desc: "Clinical-style severity targets, curated baselines, and training alignment so the fingerprint classifier could learn predictable Safe / Moderate / Severe behavior.",
              status: "Complete",
            },
            {
              label: "Phase II — Structure pathway in-browser",
              desc: "RDKit in WASM, deterministic name→structure coverage, ONNX fingerprint scorer, graceful fallback when a model file is missing, and parity between drug-name vs SMILES flows.",
              status: "Complete",
            },
            {
              label: "Phase III — Experience & clinician-adjacent reporting",
              desc: "Local history UX, downloadable backups, single-check PDFs, mechanism blurbs from bundled references, guardrails reminding users outcomes are informational.",
              status: "Complete",
            },
          ].map((phase) => (
            <div
              key={phase.label}
              className="flex flex-col md:flex-row md:items-center gap-4 p-4 rounded-2xl bg-white/60 dark:bg-navy-900 border border-slate-200/50 dark:border-white/5"
            >
              <div className="flex-1">
                <h4 className="font-bold text-navy-950 dark:text-white mb-1">{phase.label}</h4>
                <p className="text-sm text-slate-500 dark:text-slate-400">{phase.desc}</p>
              </div>
              <div className="px-3 py-1 text-xs font-bold rounded-full border bg-green-100 border-green-200 text-green-700 dark:bg-green-900/30 dark:border-green-800 dark:text-green-400 shrink-0">
                {phase.status}
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
