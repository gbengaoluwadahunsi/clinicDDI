"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

type Severity = "none" | "moderate" | "severe";

type HistoryItem = {
  id: string;
  drug1: string;
  drug2: string;
  severity: Severity;
  confidence: number;
  classProbs?: [number, number, number];
  latencyMs: number;
  timestamp: Date;
};

const STORAGE_KEY_HISTORY = "clinicalddi_history_v1";
const STORAGE_KEY_LAST_CHECK = "clinicalddi_last_check_v1";

const SEVERITY_CONFIG: Record<
  Severity,
  { label: string; bg: string; border: string; text: string; badge: string; badgeText: string; dot: string }
> = {
  none: {
    label: "No interaction detected",
    bg: "#F0FDF4",
    border: "#86EFAC",
    text: "#14532D",
    badge: "#DCFCE7",
    badgeText: "#166534",
    dot: "#22C55E",
  },
  moderate: {
    label: "Moderate interaction",
    bg: "#FFFBEB",
    border: "#FCD34D",
    text: "#78350F",
    badge: "#FEF3C7",
    badgeText: "#92400E",
    dot: "#F59E0B",
  },
  severe: {
    label: "Severe interaction — review required",
    bg: "#FFF1F2",
    border: "#FDA4AF",
    text: "#881337",
    badge: "#FFE4E6",
    badgeText: "#9F1239",
    dot: "#F43F5E",
  },
};

export default function HistoryPage() {
  const router = useRouter();
  const [history, setHistory] = useState<HistoryItem[]>([]);

  useEffect(() => {
    try {
      const rawHistory = window.localStorage.getItem(STORAGE_KEY_HISTORY);
      if (!rawHistory) return;
      const parsed = JSON.parse(rawHistory) as Array<
        Omit<HistoryItem, "timestamp"> & { timestampMs: number }
      >;
      setHistory(
        parsed.map(item => ({
          ...item,
          timestamp: new Date(item.timestampMs),
        }))
      );
    } catch (e) {
      console.error(e);
    }
  }, []);

  function clearHistory() {
    setHistory([]);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STORAGE_KEY_HISTORY);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#F8FAFC", fontFamily: "'DM Sans', 'Helvetica Neue', Arial, sans-serif" }}>
      {/* Header */}
      <header style={{ background: "#0F2A3F", padding: "0 32px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "#1D9E75", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: "#fff", fontWeight: 700, fontSize: 16 }}>Rx</span>
          </div>
          <div>
            <div style={{ color: "#fff", fontWeight: 700, fontSize: 18, letterSpacing: "-0.3px" }}>ClinicalDDI</div>
            <div style={{ color: "#9FE1CB", fontSize: 11 }}>Drug Interaction Checker</div>
          </div>
        </div>
        <button
          onClick={() => router.push("/", { scroll: false })}
          style={{
            background: "#1D9E75",
            border: "none",
            color: "#fff",
            padding: "8px 14px",
            borderRadius: 10,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          New check
        </button>
      </header>

      {/* Nav Tabs */}
      <nav style={{ background: "#fff", borderBottom: "1px solid #E2E8F0", padding: "0 32px", display: "flex", gap: 0, position: "relative", zIndex: 50 }}>
        <button onClick={() => router.push("/", { scroll: false })} style={{ padding: "14px 20px", border: "none", background: "none", cursor: "pointer", fontSize: 14, fontWeight: 600, letterSpacing: "0.2px", color: "#64748B", borderBottom: "2px solid transparent", textTransform: "capitalize", transition: "all 0.15s" }}>
          Checker
        </button>
        <button style={{ padding: "14px 20px", border: "none", background: "none", cursor: "pointer", fontSize: 14, fontWeight: 600, letterSpacing: "0.2px", color: "#0F2A3F", borderBottom: "2px solid #1D9E75", textTransform: "capitalize", transition: "all 0.15s" }}>
          History
        </button>
        <button onClick={() => router.push("/about", { scroll: false })} style={{ padding: "14px 20px", border: "none", background: "none", cursor: "pointer", fontSize: 14, fontWeight: 600, letterSpacing: "0.2px", color: "#64748B", borderBottom: "2px solid transparent", textTransform: "capitalize", transition: "all 0.15s" }}>
          About
        </button>
      </nav>

      <main style={{ maxWidth: 780, margin: "0 auto", padding: "32px 24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#0F2A3F" }}>Check history</h2>
          {history.length > 0 && (
            <button
              onClick={clearHistory}
              style={{
                padding: "8px 16px",
                fontSize: 13,
                fontWeight: 600,
                background: "#FEF2F2",
                color: "#991B1B",
                border: "1px solid #FECACA",
                borderRadius: 8,
                cursor: "pointer",
              }}
            >
              Clear history
            </button>
          )}
        </div>

        {history.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: "#94A3B8", fontSize: 15 }}>
            No checks yet — run your first interaction check
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {history.map(h => {
              const cfg = SEVERITY_CONFIG[h.severity];
              return (
                <div
                  key={h.id}
                  style={{
                    background: "#fff",
                    borderRadius: 12,
                    border: `1px solid ${cfg.border}`,
                    padding: "16px 20px",
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                    cursor: "pointer",
                  }}
                  onClick={() => {
                    if (typeof window !== "undefined") {
                      window.localStorage.setItem(
                        STORAGE_KEY_LAST_CHECK,
                        JSON.stringify({ drug1: h.drug1, drug2: h.drug2 })
                      );
                    }
                    router.push("/", { scroll: false });
                  }}
                >
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: cfg.dot, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "#0F2A3F" }}>
                      {h.drug1} + {h.drug2}
                    </div>
                    <div style={{ fontSize: 13, color: "#64748B", marginTop: 2 }}>{cfg.label}</div>
                    {h.classProbs && (
                      <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 4 }}>
                        No {(h.classProbs[0] * 100).toFixed(0)}% · Mod {(h.classProbs[1] * 100).toFixed(0)}% · Sev {(h.classProbs[2] * 100).toFixed(0)}%
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ background: cfg.badge, color: cfg.badgeText, fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 12, marginBottom: 4 }}>
                      {(h.confidence * 100).toFixed(1)}%
                    </div>
                    <div style={{ fontSize: 11, color: "#94A3B8" }}>
                      {h.latencyMs}ms · {h.timestamp.toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <footer style={{ borderTop: "1px solid #E2E8F0", padding: "16px 32px", textAlign: "center", fontSize: 12, color: "#94A3B8" }}>
        ClinicalDDI · For clinical decision support only · Always verify with current drug references
      </footer>
    </div>
  );
}

