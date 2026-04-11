import { ShieldCheck, Server, Database, CheckCircle, Verified } from "lucide-react";

export default function AboutPage() {
  return (
    <main className="w-full max-w-4xl mx-auto px-6 py-12">
      <div className="text-center mb-16 animate-slide-up">
        <h1 className="text-4xl md:text-5xl font-outfit font-extrabold tracking-tight text-navy-950 dark:text-white mb-6">
          Architected for <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-600 to-brand-400">Security</span> & <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-600 to-brand-400">Scale</span>
        </h1>
        <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
          ClinicalDDI Pro is the industry’s first enterprise-grade drug interaction platform that maintains a Zero Data Transmission policy while offering world-class AI capabilities.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-8 mb-16">
        <div className="glass rounded-3xl p-8 animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <div className="w-12 h-12 rounded-xl bg-brand-50 dark:bg-brand-900/40 text-brand-600 dark:text-brand-400 flex items-center justify-center mb-6">
            <Server size={24} />
          </div>
          <h2 className="text-xl font-bold text-navy-950 dark:text-white mb-4">Edge AI Inference</h2>
          <p className="text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
            Unlike legacy clinical decision support systems, all model inference occurs instantaneously on your localized device utilizing WebAssembly and ONNX Runtime. Your patient queries are never sent to external servers.
          </p>
          <ul className="space-y-3">
            {[
              "INT8 Quantization for maximum performance",
              "Sub-5ms median inference latency",
              "Works completely offline in restricted environments"
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
          <h2 className="text-xl font-bold text-navy-950 dark:text-white mb-4">Cloud Synchronization</h2>
          <p className="text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
            By migrating to the Enterprise Pro tier, institutions unlock cross-device synchronization and aggregated telemetry via our compliant secure commercial cloud, powered by Prisma and PostgreSQL.
          </p>
          <ul className="space-y-3">
            {[
              "Enterprise authentication and SSO integrations",
              "Cross-device localized caching architecture",
              "Aggregated query volume telemetry"
            ].map(item => (
              <li key={item} className="flex gap-3 text-sm font-semibold text-navy-800 dark:text-slate-300">
                <CheckCircle size={18} className="text-amber-500 shrink-0" /> {item}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="glass rounded-3xl p-10 animate-slide-up" style={{ animationDelay: '0.3s' }}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
          <div>
            <h2 className="text-2xl font-bold text-navy-950 dark:text-white mb-2 flex items-center gap-3">
              <Verified className="text-brand-500" /> BioBERT Target Roadmap
            </h2>
            <p className="text-slate-600 dark:text-slate-400">
              Continuous validation and deployment pipeline for clinical intelligence capability.
            </p>
          </div>
          <div className="px-4 py-2 bg-slate-100 dark:bg-navy-800 text-slate-700 dark:text-slate-300 rounded-xl font-bold text-sm">
            Current AUROC: <span className="text-brand-600 dark:text-brand-400">0.96</span>
          </div>
        </div>

        <div className="space-y-4">
          {[
            { label: "Phase I (Current)", desc: "TWOSIDES 63,000+ pairs & curated clinical baselines", status: "Active" },
            { label: "Phase II (In Progress)", desc: "DrugBank 300,000+ commercial interaction profiles", status: "Validating" },
            { label: "Phase III (Target)", desc: "1,000,000+ dynamic pairs utilizing aggregated FAERS data", status: "Upcoming" },
          ].map((phase, i) => (
            <div key={phase.label} className="flex flex-col md:flex-row md:items-center gap-4 p-4 rounded-2xl bg-white/60 dark:bg-navy-900 border border-slate-200/50 dark:border-white/5">
              <div className="flex-1">
                <h4 className="font-bold text-navy-950 dark:text-white mb-1">{phase.label}</h4>
                <p className="text-sm text-slate-500 dark:text-slate-400">{phase.desc}</p>
              </div>
              <div className={`px-3 py-1 text-xs font-bold rounded-full border ${phase.status === "Active" ? "bg-green-100 border-green-200 text-green-700 dark:bg-green-900/30 dark:border-green-800 dark:text-green-400"
                  : phase.status === "Validating" ? "bg-amber-100 border-amber-200 text-amber-700 dark:bg-amber-900/30 dark:border-amber-800 dark:text-amber-400"
                    : "bg-slate-100 border-slate-200 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400"
                }`}>
                {phase.status}
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
