/** Shared labels for severity-based UI (history + dashboard report). */

export type ReportSeverity = "none" | "moderate" | "severe";
export type ReportSource = "bert_names" | "structure_fp" | "structure_similarity";

export function predictedOutcomeShort(severity: ReportSeverity): string {
  switch (severity) {
    case "none":
      return "No interaction";
    case "moderate":
      return "Moderate";
    case "severe":
      return "Severe";
  }
}

/** Plain-language result for patients and non-experts (dashboard + history). */
export function simpleInteractionHeadline(params: {
  severity: ReportSeverity;
  source?: ReportSource;
  structureNote?: string;
  identicalCompoundPair?: boolean;
}): string {
  if (params.identicalCompoundPair) return "Same medication — not two different drugs";
  if (params.source === "structure_similarity") return "Could not score interaction";
  if (params.structureNote && params.source === "structure_fp") return "Could not complete this check";
  switch (params.severity) {
    case "none":
      return "No interaction";
    case "moderate":
      return "Moderate interaction";
    case "severe":
      return "Severe interaction";
  }
}
