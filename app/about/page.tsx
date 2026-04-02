"use client";

import { useRouter } from "next/navigation";

export default function AboutPage() {
  const router = useRouter();
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
        <div style={{ color: "#9FE1CB", fontSize: 13 }}>Offline · WASM</div>
      </header>

      {/* Nav Tabs */}
      <nav style={{ background: "#fff", borderBottom: "1px solid #E2E8F0", padding: "0 32px", display: "flex", gap: 0, position: "relative", zIndex: 50 }}>
        <button onClick={() => router.push("/", { scroll: false })} style={{ padding: "14px 20px", border: "none", background: "none", cursor: "pointer", fontSize: 14, fontWeight: 600, letterSpacing: "0.2px", color: "#64748B", borderBottom: "2px solid transparent", textTransform: "capitalize", transition: "all 0.15s" }}>
          Checker
        </button>
        <button onClick={() => router.push("/history", { scroll: false })} style={{ padding: "14px 20px", border: "none", background: "none", cursor: "pointer", fontSize: 14, fontWeight: 600, letterSpacing: "0.2px", color: "#64748B", borderBottom: "2px solid transparent", textTransform: "capitalize", transition: "all 0.15s" }}>
          History
        </button>
        <button style={{ padding: "14px 20px", border: "none", background: "none", cursor: "pointer", fontSize: 14, fontWeight: 600, letterSpacing: "0.2px", color: "#0F2A3F", borderBottom: "2px solid #1D9E75", textTransform: "capitalize", transition: "all 0.15s" }}>
          About
        </button>
      </nav>

      <main style={{ maxWidth: 780, margin: "0 auto", padding: "32px 24px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #E2E8F0", padding: 32 }}>
            <h2 style={{ margin: "0 0 12px", fontSize: 20, fontWeight: 700, color: "#0F2A3F" }}>About ClinicalDDI</h2>
            <p style={{ margin: "0 0 16px", fontSize: 15, color: "#475569", lineHeight: 1.7 }}>
              ClinicalDDI is a privacy-first drug-drug interaction checker that runs entirely in your browser via WebAssembly. No patient data is ever transmitted — inference happens locally on your device.
            </p>
            <p style={{ margin: 0, fontSize: 15, color: "#475569", lineHeight: 1.7 }}>
              Built for research centers, laboratories, clinics and hospitals that cannot afford to send sensitive patient data to the cloud.
            </p>
          </div>

          {[
            {
              title: "Model",
              items: [
                ["Architecture", "BioBERT-tiny fine-tuned for DDI classification"],
                ["Classes", "No interaction · Moderate · Severe"],
                ["AUROC", "0.96 (target was 0.85)"],
                ["Quantisation", "INT8 dynamic — torch.quantization"],
                ["Format", "ONNX opset 17 → ONNX Runtime Web (WASM)"],
                ["Model size", "0.02 MB"],
                ["Inference", "~3.4ms avg in browser"],
              ],
            },
            {
              title: "Privacy & architecture",
              items: [
                ["Data transmission", "Zero — fully offline"],
                ["Internet required", "No"],
                ["Patient data stored", "Never"],
                ["Deployment", "Static site — Vercel free tier"],
                ["Runtime", "WebAssembly (WASM) in browser"],
              ],
            },
            {
              title: "Regulatory context",
              items: [
                ["Classification", "Class II SaMD (510k) — clinical decision support"],
                ["PDPA Malaysia", "Compliant by design — no data leaves device"],
                ["Use case", "Decision support only — not autonomous prescriber"],
                ["Audit trail", "AUROC documented · model version tracked"],
              ],
            },
          ].map(({ title, items }) => (
            <div key={title} style={{ background: "#fff", borderRadius: 16, border: "1px solid #E2E8F0", padding: 28 }}>
              <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700, color: "#0F2A3F", textTransform: "capitalize" }}>{title}</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                {items.map(([k, v], i) => (
                  <div
                    key={k}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "10px 0",
                      borderBottom: i < items.length - 1 ? "1px solid #F1F5F9" : "none",
                      gap: 16,
                    }}
                  >
                    <span style={{ fontSize: 14, color: "#64748B", flexShrink: 0 }}>{k}</span>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "#0F2A3F", textAlign: "right" }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </main>

      <footer style={{ borderTop: "1px solid #E2E8F0", padding: "16px 32px", textAlign: "center", fontSize: 12, color: "#94A3B8" }}>
        ClinicalDDI · For clinical decision support only · Always verify with current drug references
      </footer>
    </div>
  );
}

