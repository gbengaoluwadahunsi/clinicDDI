"use client";

import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils"; // I'll check if this exists or create a simple fallback

interface SubscriptionButtonProps {
    variant?: "primary" | "secondary";
    className?: string;
}

export function SubscriptionButton({ variant = "primary", className }: SubscriptionButtonProps) {
    const [loading, setLoading] = useState(false);

    const onClick = async () => {
        try {
            setLoading(true);
            const response = await fetch("/api/stripe/checkout");
            const data = await response.json();

            if (data.url) {
                window.location.href = data.url;
            }
        } catch (error) {
            console.error("Subscription error:", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <button
            onClick={onClick}
            disabled={loading}
            className={cn(
                "group flex items-center justify-center gap-2 px-8 py-4 rounded-2xl font-bold transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed w-full",
                variant === "primary"
                    ? "bg-gradient-to-r from-brand-600 to-brand-500 text-white shadow-xl shadow-brand-500/25 hover:shadow-brand-500/40"
                    : "bg-white dark:bg-navy-800 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-700",
                className
            )}
        >
            {loading ? (
                <Loader2 className="animate-spin" size={18} />
            ) : (
                <>
                    <Sparkles size={18} className="text-accent-400 group-hover:scale-125 transition-transform" />
                    Upgrade to Pro
                </>
            )}
        </button>
    );
}
