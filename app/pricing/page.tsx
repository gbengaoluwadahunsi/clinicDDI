import Link from "next/link";
import { Check, Sparkles, ShieldCheck, Zap, X } from "lucide-react";
import { SubscriptionButton } from "@/components/SubscriptionButton";

const PLANS = [
    {
        name: "Free",
        price: "$0",
        period: "forever",
        description: "For individual clinicians exploring drug interaction intelligence.",
        cta: "Start Free",
        ctaLink: "/dashboard",
        ctaStyle: "border border-slate-200 dark:border-white/10 text-slate-700 dark:text-white hover:bg-slate-50 dark:hover:bg-white/5",
        featured: false,
        features: [
            { text: "Unlimited edge AI checks", included: true },
            { text: "Full 3-class severity classification", included: true },
            { text: "Probability distribution breakdown", included: true },
            { text: "Offline mode", included: true },
            { text: "Local browser history (IndexedDB)", included: true },
            { text: "Community model updates", included: true },
            { text: "JSON data export", included: true },
            { text: "Encrypted local history", included: false },
            { text: "PDF clinical reports", included: false },
            { text: "Team collaboration", included: false },
            { text: "Priority model updates", included: false },
            { text: "Email & Slack support", included: false },
        ],
    },
    {
        name: "Pro",
        price: "$12",
        period: "per month",
        description: "For professionals who need persistent audit trails and team features.",
        cta: "Upgrade to Pro",
        ctaLink: "/api/stripe/checkout",
        ctaStyle: "bg-gradient-to-r from-brand-600 to-brand-500 text-white hover:from-brand-500 hover:to-accent-600 shadow-lg shadow-brand-500/25",
        featured: true,
        features: [
            { text: "Unlimited edge AI checks", included: true },
            { text: "Full 3-class severity classification", included: true },
            { text: "Probability distribution breakdown", included: true },
            { text: "Offline mode", included: true },
            { text: "Local browser history (IndexedDB)", included: true },
            { text: "Priority BioBERT model updates", included: true },
            { text: "JSON + PDF report export", included: true },
            { text: "Professional Offline PDF reports", included: true },
            { text: "Local audit log management", included: true },
            { text: "Team collaboration (up to 5 seats)", included: true },
            { text: "Priority model updates", included: true },
            { text: "Email & Slack support", included: true },
        ],
    },
    {
        name: "Enterprise",
        price: "Custom",
        period: "",
        description: "For hospital systems and large healthcare organizations.",
        cta: "Contact Sales",
        ctaLink: "mailto:contact@clinicalddi.com",
        ctaStyle: "bg-navy-950 dark:bg-white dark:text-navy-950 text-white hover:bg-navy-800 dark:hover:bg-slate-100",
        featured: false,
        features: [
            { text: "Everything in Pro", included: true },
            { text: "Unlimited team seats", included: true },
            { text: "Custom model fine-tuning", included: true },
            { text: "SSO & SAML authentication", included: true },
            { text: "On-premise deployment option", included: true },
            { text: "SLA guarantee (99.9% uptime)", included: true },
            { text: "Dedicated account manager", included: true },
            { text: "HIPAA BAA agreement", included: true },
            { text: "Custom API access", included: true },
            { text: "Audit compliance reporting", included: true },
            { text: "24/7 phone support", included: true },
            { text: "Training & onboarding", included: true },
        ],
    },
];

export default function PricingPage() {
    return (
        <main className="w-full max-w-7xl mx-auto px-6 py-16">
            <div className="text-center mb-16 animate-slide-up">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-400 text-sm font-bold mb-6">
                    <Sparkles size={16} /> Simple, transparent pricing
                </div>
                <h1 className="text-4xl md:text-6xl font-outfit font-extrabold tracking-tight text-navy-950 dark:text-white mb-6">
                    Free to start. <span className="gradient-text">Pro to scale.</span>
                </h1>
                <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
                    The core AI engine is free forever — no limits, no ads, no data harvesting.
                    Upgrade to Pro for persistent history, PDF exports, and team collaboration.
                </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6 mb-20">
                {PLANS.map((plan, i) => (
                    <div
                        key={plan.name}
                        className={`relative rounded-3xl p-8 animate-slide-up ${plan.featured
                            ? "bg-gradient-to-b from-brand-600/5 to-accent-500/5 border-2 border-brand-500/30 shadow-xl shadow-brand-500/10"
                            : "glass"
                            }`}
                        style={{ animationDelay: `${0.1 * i}s` }}
                    >
                        {plan.featured && (
                            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-gradient-to-r from-brand-500 to-accent-500 text-white text-xs font-bold shadow-lg">
                                MOST POPULAR
                            </div>
                        )}

                        <div className="mb-8">
                            <div className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3">{plan.name}</div>
                            <div className="text-5xl font-outfit font-extrabold text-navy-950 dark:text-white mb-1">
                                {plan.price}
                                {plan.period && <span className="text-lg text-slate-500 font-normal ml-1">/{plan.period}</span>}
                            </div>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">{plan.description}</p>
                        </div>

                        {plan.name === "Pro" ? (
                            <div className="mb-8">
                                <SubscriptionButton />
                            </div>
                        ) : (
                            <Link
                                href={plan.ctaLink}
                                className={`block w-full text-center py-3.5 rounded-xl font-bold transition-all active:scale-[0.97] mb-8 ${plan.ctaStyle}`}
                            >
                                {plan.cta}
                            </Link>
                        )}

                        <ul className="space-y-3">
                            {plan.features.map(f => (
                                <li key={f.text} className={`flex items-start gap-3 text-sm ${f.included ? "text-slate-700 dark:text-slate-300" : "text-slate-400 dark:text-slate-600"}`}>
                                    {f.included ? (
                                        <Check size={16} className="text-brand-500 shrink-0 mt-0.5" />
                                    ) : (
                                        <X size={16} className="text-slate-300 dark:text-slate-700 shrink-0 mt-0.5" />
                                    )}
                                    {f.text}
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
            </div>

            {/* FAQ */}
            <div className="max-w-3xl mx-auto">
                <h2 className="text-2xl font-outfit font-bold text-navy-950 dark:text-white mb-8 text-center">Frequently Asked Questions</h2>
                <div className="space-y-4">
                    {[
                        { q: "Is the Free plan really unlimited?", a: "Yes. The AI engine runs entirely on your device using WebAssembly — there is no server cost to us. You can check as many drug pairs as you want, forever." },
                        { q: "What do I get with Pro?", a: "Pro adds advanced local persistence (Infinite history), PDF clinical report generation, team collaboration for up to 5 members, and priority access to new BioBERT model versions—all while keeping your data 100% on-device." },
                        { q: "Is my patient data safe?", a: "Absolutely. Drug names are processed locally in your browser. Even on Pro, your data never leaves your device — reports and history are stored in your browser's encrypted local storage." },
                        { q: "Can I cancel Pro anytime?", a: "Yes, you can cancel at any time. Your local history will remain accessible on your device regardless of your subscription status." },
                    ].map(faq => (
                        <div key={faq.q} className="glass rounded-2xl p-6">
                            <h3 className="font-bold text-navy-950 dark:text-white mb-2">{faq.q}</h3>
                            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{faq.a}</p>
                        </div>
                    ))}
                </div>
            </div>
        </main>
    );
}
