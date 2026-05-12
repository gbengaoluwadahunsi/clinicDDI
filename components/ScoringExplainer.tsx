import { Info } from "lucide-react";

type Props = { variant?: "card" | "inline"; className?: string };

/**
 * Plain-language copy: 3-way headline + what the main % means (no jargon).
 */
export function ScoringExplainer({ variant = "card", className = "" }: Props) {
  if (variant === "inline") {
    return (
      <p className={`text-xs text-slate-600 dark:text-slate-400 leading-relaxed border-l-2 border-brand-500 pl-3 ${className}`}>
        <span className="font-bold text-slate-800 dark:text-slate-200">Reading this result: </span>
        You see three shares—<strong>Safe</strong>, <strong>Moderate</strong>, and <strong>Severe</strong>—that usually add up
        to about 100%. The headline is whichever share is <strong>largest</strong>. The big percentage next to the headline is
        only that share—not a doctor-style &quot;risk score&quot; and not a separate &quot;interaction %.&quot;
      </p>
    );
  }

  return (
    <aside
      className={`rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50/90 dark:bg-white/[0.03] p-4 text-sm text-slate-600 dark:text-slate-300 ${className}`}
      aria-label="How to read drug interaction results"
    >
      <div className="flex gap-2 font-bold text-navy-950 dark:text-white mb-3">
        <Info className="shrink-0 text-brand-500" size={18} aria-hidden />
        How to read the three-way result
      </div>
      <ol className="list-decimal pl-5 space-y-2 leading-relaxed">
        <li>
          The app assigns a share to <strong>Safe</strong>, <strong>Moderate</strong>, and <strong>Severe</strong>. Those
          three numbers usually total about <strong>100%</strong>.
        </li>
        <li>
          The <strong>headline label</strong> is whichever category has the <strong>highest</strong> share—it is not a Yes/No
          &quot;interaction&quot; switch on its own.
        </li>
        <li>
          The <strong>confidence %</strong> is how much weight sits on that headline category alone (for example 52%
          means the tool leans mild toward &quot;safe&quot; while the rest split the remainder).{" "}
          <strong>It is not</strong> medical advice or a proven chance of harm.
        </li>
      </ol>
    </aside>
  );
}
