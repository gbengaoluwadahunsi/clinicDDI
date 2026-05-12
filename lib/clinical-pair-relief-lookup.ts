import type { PairExplanation } from "@/lib/pair-explanation-lookup";
import { pairKey } from "@/lib/pair-explanation-lookup";
import table from "./clinical-pair-relief.json";

/** Pairs where common clinical references disagree with the ML scorer; skip model and show this note with “no interaction”. */
export function lookupClinicalReliefPair(a: string, b: string): PairExplanation | null {
  const row = (table as Record<string, PairExplanation>)[pairKey(a, b)];
  return row ?? null;
}
