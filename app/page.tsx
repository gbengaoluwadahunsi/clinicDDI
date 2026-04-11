import Link from "next/link";
import Image from "next/image";
import { ShieldCheck, Zap, Lock, Brain, Activity, ArrowRight, Sparkles, Globe, Server, ChevronRight, CheckCircle2, ShieldAlert, Cpu } from "lucide-react";

export default function LandingPage() {
    return (
        <div className="flex flex-col min-h-screen bg-navy-950 text-white selection:bg-brand-500/30">
            {/* ─── HERO ─── */}
            <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden">
                {/* Background Image with Mask */}
                <div className="absolute inset-0 z-0">
                    <Image
                        src="/clinical_ai_hero_1775894702285.png"
                        alt="Clinical AI Hero"
                        fill
                        className="object-cover hero-mask opacity-60 scale-105 animate-float"
                        priority
                    />
                    <div className="absolute inset-0 bg-gradient-to-b from-navy-950/20 via-navy-950/40 to-navy-950" />
                </div>

                <div className="max-w-7xl mx-auto px-6 text-center relative z-10 pt-20">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-brand-400 text-xs font-bold mb-8 animate-fade-in backdrop-blur-md tracking-wider uppercase">
                        <Cpu size={14} className="text-accent-400 animate-pulse" />
                        Next-Gen Edge Intelligence
                    </div>

                    <h1 className="text-6xl md:text-8xl lg:text-9xl font-extrabold tracking-tighter mb-8 animate-slide-up leading-[0.85] text-balance">
                        Predicting <br />
                        <span className="gradient-text">Interactions.</span>
                    </h1>

                    <p className="text-xl md:text-2xl text-slate-300 max-w-2xl mx-auto mb-12 animate-slide-up leading-relaxed font-medium" style={{ animationDelay: '0.2s' }}>
                        The world's first <span className="text-white border-b border-brand-500/50">zero-server</span> clinical intelligence engine.
                        Enterprise-grade BioBERT inference, locally in your browser.
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-6 animate-slide-up" style={{ animationDelay: '0.4s' }}>
                        <Link
                            href="/dashboard"
                            className="group px-10 py-5 bg-white text-navy-950 hover:bg-brand-50 rounded-full font-bold flex items-center gap-3 transition-all active:scale-[0.98] text-lg shadow-2xl shadow-white/10"
                        >
                            Get Started
                            <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                        </Link>
                        <Link
                            href="/pricing"
                            className="px-10 py-5 bg-navy-900/50 backdrop-blur-xl border border-white/10 text-white rounded-full font-bold hover:bg-white/5 transition-all active:scale-[0.98] flex items-center gap-2 text-lg"
                        >
                            Explore Plans
                        </Link>
                    </div>

                    {/* Trust indicators */}
                    <div className="mt-20 flex flex-wrap items-center justify-center gap-x-12 gap-y-6 opacity-40 grayscale transition-all hover:opacity-80 hover:grayscale-0 animate-fade-in" style={{ animationDelay: '0.6s' }}>
                        <div className="flex items-center gap-2 font-bold text-xl tracking-tighter"><ShieldCheck size={24} /> HIPAA COMPLIANT</div>
                        <div className="flex items-center gap-2 font-bold text-xl tracking-tighter"><Lock size={24} /> ZERO DATA STORAGE</div>
                        <div className="flex items-center gap-2 font-bold text-xl tracking-tighter"><Activity size={24} /> 96% AUROC</div>
                    </div>
                </div>
            </section>

            {/* ─── ENTERPRISE FEATURES (Amazon/AWS Style) ─── */}
            <section className="py-32 relative bg-white text-navy-950">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="flex flex-col md:flex-row justify-between items-end gap-8 mb-20">
                        <div className="max-w-2xl">
                            <h2 className="text-4xl md:text-6xl font-extrabold mb-6 tracking-tight">
                                Intelligence without the <span className="text-brand-600">infrastructure.</span>
                            </h2>
                            <p className="text-xl text-slate-600 leading-relaxed font-medium">
                                ClinicalDDI offloads AI inference to the edge, eliminating the need for complex server architectures while maintaining unparalleled privacy standards.
                            </p>
                        </div>
                        <div className="pb-2">
                            <Link href="/about" className="text-brand-600 font-bold flex items-center gap-2 hover:gap-3 transition-all">
                                How it works <ArrowRight size={20} />
                            </Link>
                        </div>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8">
                        {[
                            {
                                icon: ShieldAlert,
                                title: "Risk Mitigation",
                                desc: "Identify high-risk drug-drug interactions with clinically validated severity scoring and evidence-based reporting.",
                                accent: "bg-red-500/10 text-red-600"
                            },
                            {
                                icon: Cpu,
                                title: "Edge Architecture",
                                desc: "No API calls. The BioBERT model runs via Onyx/WebAssembly directly in the client's V8 engine for sub-5ms performance.",
                                accent: "bg-brand-500/10 text-brand-600"
                            },
                            {
                                icon: Globe,
                                title: "Offline Readiness",
                                desc: "Designed for resilient medical environments. Load once, run anywhere—even in remote areas with zero connectivity.",
                                accent: "bg-accent-500/10 text-accent-600"
                            }
                        ].map((item) => (
                            <div key={item.title} className="p-10 rounded-[2rem] border border-slate-100 hover:border-brand-200 transition-all hover:shadow-2xl hover:shadow-brand-500/5 group">
                                <div className={`w-16 h-16 rounded-2xl ${item.accent} flex items-center justify-center mb-8 transition-transform group-hover:scale-110`}>
                                    <item.icon size={32} />
                                </div>
                                <h3 className="text-2xl font-bold mb-4">{item.title}</h3>
                                <p className="text-slate-500 leading-relaxed font-medium text-lg">{item.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ─── PRODUCT HIGHLIGHT (Tesla Style) ─── */}
            <section className="py-32 bg-navy-950 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-brand-500/10 to-transparent pointer-events-none" />
                <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-2 items-center gap-20">
                    <div className="relative aspect-square rounded-[3rem] overflow-hidden border border-white/5 animate-slide-up">
                        <div className="absolute inset-0 bg-brand-500/20 mix-blend-overlay" />
                        <div className="absolute inset-0 flex items-center justify-center">
                            <Brain size={200} className="text-brand-400 opacity-20 animate-pulse" />
                        </div>
                        <div className="absolute bottom-10 left-10 p-8 glass rounded-3xl border-white/10 max-w-xs">
                            <div className="text-xs font-bold uppercase tracking-widest text-brand-400 mb-2">Real-time Inference</div>
                            <div className="text-3xl font-extrabold mb-1 tracking-tight">4.8ms</div>
                            <div className="text-sm text-slate-400">Average pair validation latency</div>
                        </div>
                    </div>
                    <div>
                        <h2 className="text-4xl md:text-7xl font-extrabold mb-8 tracking-tighter leading-tight">
                            Powered by <br />
                            <span className="gradient-text">BioBERT 3.0</span>
                        </h2>
                        <p className="text-xl text-slate-400 mb-10 leading-relaxed font-medium">
                            Our proprietary optimization of the BERT architecture is specifically fine-tuned on the TWOSIDES dataset, achieving 0.96 AUROC. It delivers professional-grade accuracy without the overhead of cloud computing.
                        </p>
                        <div className="space-y-4">
                            {["Integrated severity classification", "Multi-drug pathway analysis", "Standardized MedDRA output"].map(f => (
                                <div key={f} className="flex items-center gap-3 text-lg font-bold">
                                    <CheckCircle2 size={24} className="text-brand-500" /> {f}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* ─── PRICING PREVIEW ─── */}
            <section className="py-32 bg-white text-navy-950">
                <div className="max-w-7xl mx-auto px-6 text-center">
                    <h2 className="text-4xl md:text-6xl font-extrabold mb-20 tracking-tight">Simple, transparent pricing.</h2>
                    <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
                        {/* Free */}
                        <div className="p-12 rounded-[2.5rem] bg-slate-50 border border-slate-100 text-left transition-all hover:scale-[1.02]">
                            <div className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-6">Standard</div>
                            <div className="text-6xl font-extrabold mb-4">$0</div>
                            <p className="text-slate-500 mb-10 font-medium">Perfect for researchers and individual clinicians.</p>
                            <ul className="space-y-4 mb-10">
                                {["Unlimited Local Checks", "BioBERT 3.0 Model", "Offline Mode"].map(f => (
                                    <li key={f} className="flex items-center gap-3 font-bold text-slate-700">
                                        <ChevronRight size={18} className="text-brand-500" /> {f}
                                    </li>
                                ))}
                            </ul>
                            <Link href="/dashboard" className="block w-full py-4 bg-navy-950 text-white text-center rounded-2xl font-bold hover:bg-brand-600 transition-all">
                                Start Free
                            </Link>
                        </div>
                        {/* Pro */}
                        <div className="p-12 rounded-[2.5rem] bg-navy-900 text-white text-left transition-all hover:scale-[1.02] shadow-2xl shadow-brand-500/20">
                            <div className="text-sm font-bold uppercase tracking-widest text-brand-400 mb-6 font-mono">Professional</div>
                            <div className="text-6xl font-extrabold mb-4">$12</div>
                            <p className="text-slate-400 mb-10 font-medium">For clinical teams requiring audit-ready reporting.</p>
                            <ul className="space-y-4 mb-10">
                                {["Cloud-Synced History", "PDF Clinical Export", "Extended Audit Logs"].map(f => (
                                    <li key={f} className="flex items-center gap-3 font-bold text-white">
                                        <Sparkles size={18} className="text-accent-400" /> {f}
                                    </li>
                                ))}
                            </ul>
                            <Link href="/dashboard" className="block w-full py-4 bg-gradient-to-r from-brand-600 to-brand-500 text-white text-center rounded-2xl font-bold hover:opacity-90 transition-all">
                                Upgrade to Pro
                            </Link>
                        </div>
                    </div>
                </div>
            </section>

            {/* ─── CTA ─── */}
            <section className="py-40 bg-navy-950 relative overflow-hidden">
                <div className="absolute inset-0 mesh-gradient-premium opacity-30" />
                <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
                    <h2 className="text-5xl md:text-8xl font-extrabold mb-10 tracking-tighter">
                        Experience the <br /> <span className="gradient-text">new standard.</span>
                    </h2>
                    <Link
                        href="/dashboard"
                        className="inline-flex items-center gap-4 px-12 py-6 bg-white text-navy-950 rounded-full font-bold text-xl hover:scale-110 active:scale-95 transition-all shadow-2xl shadow-white/10"
                    >
                        Launch Free Dashboard <ArrowRight size={24} />
                    </Link>
                </div>
            </section>

            {/* ─── FOOTER ─── */}
            <footer className="py-20 bg-white text-navy-950 border-t border-slate-100">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="flex flex-col md:flex-row justify-between items-start gap-12 mb-20">
                        <div>
                            <div className="flex items-center gap-2 mb-6">
                                <div className="w-10 h-10 rounded-xl bg-navy-950 flex items-center justify-center text-white">
                                    <ShieldCheck size={20} />
                                </div>
                                <span className="font-extrabold text-2xl tracking-tighter">ClinicalDDI</span>
                            </div>
                            <p className="text-slate-500 max-w-xs font-medium">
                                Redefining clinical intelligence with privacy-first edge AI.
                            </p>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-12 text-sm font-bold">
                            <div className="space-y-4">
                                <Link href="#" className="block hover:text-brand-600">Product</Link>
                                <Link href="#" className="block hover:text-brand-600">Features</Link>
                                <Link href="/pricing" className="block hover:text-brand-600">Pricing</Link>
                            </div>
                            <div className="space-y-4">
                                <Link href="#" className="block hover:text-brand-600">Security</Link>
                                <Link href="#" className="block hover:text-brand-600">Compliance</Link>
                                <Link href="#" className="block hover:text-brand-600">Privacy</Link>
                            </div>
                            <div className="space-y-4">
                                <Link href="#" className="block hover:text-brand-600">GitHub</Link>
                                <Link href="#" className="block hover:text-brand-600">Docs</Link>
                                <Link href="#" className="block hover:text-brand-600">Status</Link>
                            </div>
                        </div>
                    </div>
                    <div className="pt-8 border-t border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4 text-xs font-bold text-slate-400 uppercase tracking-widest">
                        <div>© {new Date().getFullYear()} ClinicalDDI. All rights reserved.</div>
                        <div className="flex gap-8">
                            <span className="flex items-center gap-2"><Globe size={14} /> Global / English</span>
                            <span>Privacy Policy</span>
                            <span>Terms of Service</span>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
}
