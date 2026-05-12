"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Activity, ClipboardList, Info, ShieldCheck } from "lucide-react";
import { useState, useEffect } from "react";

const NAV_ITEMS = [
    { path: "/dashboard", label: "Checker", icon: Activity },
    { path: "/history", label: "History", icon: ClipboardList },
    { path: "/about", label: "About", icon: Info },
];

export function Navbar() {
    const pathname = usePathname();
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 20);
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    return (
        <header
            className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 border-b ${scrolled
                ? "bg-white/80 dark:bg-navy-950/80 backdrop-blur-xl border-slate-200/50 dark:border-white/5 shadow-lg shadow-black/[0.03]"
                : "bg-transparent border-transparent"
                }`}
        >
            <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
                {/* Logo */}
                <Link href="/" className="flex items-center gap-3 group">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-accent-500 flex items-center justify-center text-white shadow-lg shadow-brand-500/25 group-hover:shadow-brand-500/40 transition-all group-hover:scale-105">
                        <ShieldCheck size={22} className="stroke-[2.5]" />
                    </div>
                    <div>
                        <div className="font-outfit font-bold text-xl tracking-tight text-navy-950 dark:text-white flex items-center gap-2">
                            ClinicalDDI
                            <span className="px-2 py-0.5 rounded-full bg-gradient-to-r from-brand-500 to-accent-500 text-white text-[10px] uppercase tracking-wider font-bold shadow-sm">Free</span>
                        </div>
                        <div className="text-xs text-slate-500 font-medium tracking-wide">Local fingerprint inference</div>
                    </div>
                </Link>

                {/* Desktop Nav */}
                <nav className="hidden md:flex items-center gap-1">
                    {NAV_ITEMS.map(({ path, label, icon: Icon }) => {
                        const isActive = pathname === path || (path === "/dashboard" && pathname === "/dashboard");
                        return (
                            <Link
                                key={path}
                                href={path}
                                className={`relative px-4 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${isActive
                                    ? "text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-500/10"
                                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/5"
                                    }`}
                            >
                                <Icon size={18} className={isActive ? "stroke-[2.5]" : "stroke-2"} />
                                {label}
                                {isActive && (
                                    <motion.div
                                        layoutId="activeNavTab"
                                        className="absolute bottom-0 left-3 right-3 h-0.5 bg-gradient-to-r from-brand-500 to-accent-500 rounded-t-full"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                    />
                                )}
                            </Link>
                        );
                    })}
                </nav>

                <div className="flex items-center gap-3">
                    {pathname === "/" ? (
                        <Link
                            href="/dashboard"
                            className="bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-accent-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-brand-500/25 hover:shadow-brand-500/40 transition-all active:scale-95"
                        >
                            Open App
                        </Link>
                    ) : null}
                </div>
            </div>
        </header>
    );
}
