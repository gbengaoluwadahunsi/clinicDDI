import type { RDKitModule } from "@rdkit/rdkit";
import bundled from "./drug-smiles.json";

let merged: Record<string, string> = { ...(bundled as Record<string, string>) };
let normalizedLookup: Map<string, string> = buildNormalizedLookup(merged);

/** Canonical SMILES (RDKit) → display name for bundled drugs; rebuilt when the merge map changes. */
let canonicalSmilesToName: Map<string, string> | null = null;

function displayNameFromKey(key: string): string {
  const t = key.trim();
  if (!t) return t;
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function invalidateCanonicalIndex(): void {
  canonicalSmilesToName = null;
}

/**
 * Precomputes canonical SMILES for every bundled structure so live typing stays fast.
 * Call when `getRDKit()` resolves (and again after merge changes if needed).
 */
export function warmDrugSmilesCanonicalIndex(rdkit: RDKitModule): void {
  const next = new Map<string, string>();
  for (const [name, s] of Object.entries(merged)) {
    const mol = rdkit.get_mol(s);
    if (!mol) continue;
    const c = mol.get_smiles();
    mol.delete();
    const label = displayNameFromKey(name);
    if (!next.has(c)) next.set(c, label);
  }
  canonicalSmilesToName = next;
}

/**
 * Best-effort: match user SMILES to a bundled drug name (exact string, then canonical form).
 * Requires `warmDrugSmilesCanonicalIndex` to have run for canonical hits across tautomers/normalization.
 */
export function findDrugNameFromSmiles(rdkit: RDKitModule, smiles: string): string | null {
  const t = smiles.trim();
  if (!t) return null;

  for (const [name, s] of Object.entries(merged)) {
    if (s.trim() === t) return displayNameFromKey(name);
  }

  if (!canonicalSmilesToName) warmDrugSmilesCanonicalIndex(rdkit);

  const mol = rdkit.get_mol(t);
  if (!mol) return null;
  const can = mol.get_smiles();
  mol.delete();

  return canonicalSmilesToName!.get(can) ?? null;
}

function normKey(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.,]/g, "");
}

function buildNormalizedLookup(rec: Record<string, string>): Map<string, string> {
  const m = new Map<string, string>();
  for (const [key, smi] of Object.entries(rec)) {
    const nk = normKey(key);
    if (nk) m.set(nk, smi);
  }
  return m;
}

/**
 * Merge Colab `public/drug_smiles.json` over the bundled map (Colab wins on key clashes).
 * Safe to call once on the client; no-op if fetch fails.
 */
export async function hydrateDrugSmilesFromPublic(): Promise<void> {
  try {
    const r = await fetch("/drug_smiles.json");
    if (!r.ok) return;
    const extra = (await r.json()) as Record<string, string>;
    merged = { ...merged, ...extra };
    normalizedLookup = buildNormalizedLookup(merged);
    invalidateCanonicalIndex();
  } catch {
    /* offline or missing file */
  }
}

/** Resolve typed drug name to SMILES (bundled + optional `public/drug_smiles.json`). */
export function resolveNameToSmiles(name: string): string | null {
  const k = normKey(name);
  if (!k) return null;
  const hit = normalizedLookup.get(k);
  if (hit) return hit;
  for (const token of k.split(" ").filter((t) => t.length >= 3)) {
    const tHit = normalizedLookup.get(token);
    if (tHit) return tHit;
  }
  return null;
}

export function allDrugNamesForAutocomplete(): string[] {
  const set = new Set<string>();
  for (const k of Object.keys(merged)) {
    const t = k.trim();
    if (!t) continue;
    set.add(displayNameFromKey(k));
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}
