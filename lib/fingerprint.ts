import type { RDKitModule } from "@rdkit/rdkit";
import { morganFingerprint, unpackFpBitsToFloat32, tanimotoSimilarity } from "./rdkit-client";

export const DEFAULT_FP_RADIUS = 2;
/** Matches Colab-trained fingerprint MLP (two Morgan FPs concatenated → 2048-dim input). */
export const DEFAULT_FP_NBITS = 1024;

export type MorganCached = { packed: Uint8Array; float: Float32Array };

const cache = new Map<string, MorganCached>();

function cacheKey(smiles: string, radius: number, nBits: number): string {
  return `${smiles}\0${radius}\0${nBits}`;
}

export function clearFingerprintCache(): void {
  cache.clear();
}

/**
 * SMILES → Morgan fingerprint as length-`nBits` Float32 (0/1) for ONNX MLP input.
 * Cached per SMILES + hyperparameters.
 */
export function smilesToFingerprint(
  rdkit: RDKitModule,
  smiles: string,
  radius = DEFAULT_FP_RADIUS,
  nBits = DEFAULT_FP_NBITS
): Float32Array | null {
  return getMorganCached(rdkit, smiles, radius, nBits)?.float ?? null;
}

/** Packed bits + unpacked floats (one RDKit parse per cache miss). */
export function getMorganCached(
  rdkit: RDKitModule,
  smiles: string,
  radius = DEFAULT_FP_RADIUS,
  nBits = DEFAULT_FP_NBITS
): MorganCached | null {
  const key = cacheKey(smiles, radius, nBits);
  const hit = cache.get(key);
  if (hit) return hit;

  const packed = morganFingerprint(rdkit, smiles, nBits, radius);
  if (!packed) return null;

  const float = unpackFpBitsToFloat32(packed, nBits);
  const row: MorganCached = { packed, float };
  cache.set(key, row);
  return row;
}

export function tanimotoFromSmiles(
  rdkit: RDKitModule,
  smiles1: string,
  smiles2: string,
  radius = DEFAULT_FP_RADIUS,
  nBits = DEFAULT_FP_NBITS
): number | null {
  const a = getMorganCached(rdkit, smiles1, radius, nBits);
  const b = getMorganCached(rdkit, smiles2, radius, nBits);
  if (!a || !b) return null;
  return tanimotoSimilarity(a.packed, b.packed);
}
