import descriptions from "./drug-descriptions.json";

export type DrugMonograph = {
  displayName: string;
  drugClass: string;
  description: string;
};

const table = descriptions as Record<string, DrugMonograph>;

function normalize(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.,]/g, "")
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Resolve a user-typed drug name to an on-device monograph entry (no network).
 * Exact token match only (after normalization) so we never guess the wrong drug from a short substring.
 */
export function lookupDrugMonograph(raw: string): DrugMonograph | null {
  const key = normalize(raw);
  if (!key) return null;

  if (table[key]) return table[key];

  const tokens = key.split(" ").filter((t) => t.length >= 3);
  for (const t of tokens) {
    if (table[t]) return table[t];
  }

  return null;
}
