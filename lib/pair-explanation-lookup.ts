import pairTable from "./ddi-pair-explanations.json";

export type PairExplanation = { title: string; text: string };

function norm(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.,]/g, "");
}

export function pairKey(a: string, b: string): string {
  const x = norm(a);
  const y = norm(b);
  return x < y ? `${x}|||${y}` : `${y}|||${x}`;
}

const table = pairTable as Record<string, PairExplanation>;

export function lookupPairExplanation(a: string, b: string): PairExplanation | null {
  const k = pairKey(a, b);
  return table[k] ?? null;
}
