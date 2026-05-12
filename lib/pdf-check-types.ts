/** Payload for PDF generation (single check from dashboard or reconstructed from IndexedDB history). */

export type ClinicalInteractionPdfPayload = {
  drug1: string;
  drug2: string;
  severity: "none" | "moderate" | "severe";
  confidence: number;
  classProbs?: [number, number, number];
  source: "bert_names" | "structure_fp" | "structure_similarity";
  latencyMs: number;
  /** ISO timestamp */
  checkedAtIso: string;
  pairExplanation?: { title: string; text: string } | null;
  smiles1?: string;
  smiles2?: string;
  tanimoto?: number;
  structureNote?: string;
  /** Both sides resolve to the same canonical structure (e.g. aspirin + aspirin). */
  identicalCompoundPair?: boolean;
  /** Curated note replaced automated score (e.g. aspirin + paracetamol). */
  clinicalReliefPair?: boolean;
};
