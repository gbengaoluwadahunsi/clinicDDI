import type { RDKitModule, RDKitLoader } from "@rdkit/rdkit";

let rdkitSingleton: RDKitModule | null = null;

export async function getRDKit(): Promise<RDKitModule> {
  if (rdkitSingleton) return rdkitSingleton;
  const mod = await import("@rdkit/rdkit");
  const init = mod.default as unknown as RDKitLoader;
  const instance = await init({
    locateFile: (file: string) =>
      typeof window !== "undefined" ? `${window.location.origin}/vendor/rdkit/${file}` : `/vendor/rdkit/${file}`,
  } as Parameters<RDKitLoader>[0]);
  rdkitSingleton = instance;
  return instance;
}

const FP_OPTS = (nBits: number, radius = 2) =>
  JSON.stringify({ radius, fplen: nBits });

export function morganFingerprint(
  rdkit: RDKitModule,
  smiles: string,
  nBits = 1024,
  radius = 2
): Uint8Array | null {
  const mol = rdkit.get_mol(smiles);
  if (!mol) return null;
  try {
    return mol.get_morgan_fp_as_uint8array(FP_OPTS(nBits, radius));
  } finally {
    mol.delete();
  }
}

function popcountByte(x: number): number {
  let n = 0;
  for (let i = 0; i < 8; i++) {
    if ((x >> i) & 1) n++;
  }
  return n;
}

/** Tanimoto similarity on packed Morgan bit vectors (same length). */
export function tanimotoSimilarity(a: Uint8Array, b: Uint8Array): number {
  const len = Math.min(a.length, b.length);
  let inter = 0;
  let ac = 0;
  let bc = 0;
  for (let i = 0; i < len; i++) {
    inter += popcountByte(a[i] & b[i]);
    ac += popcountByte(a[i]);
    bc += popcountByte(b[i]);
  }
  const union = ac + bc - inter;
  return union <= 0 ? 0 : inter / union;
}

/** Unpack packed fingerprint to 0/1 floats for ONNX models expecting bit features. */
export function unpackFpBitsToFloat32(u8: Uint8Array, nBits: number): Float32Array {
  const out = new Float32Array(nBits);
  let i = 0;
  for (let b = 0; b < u8.length && i < nBits; b++) {
    const byte = u8[b];
    for (let k = 0; k < 8 && i < nBits; k++) {
      out[i++] = ((byte >> k) & 1) === 1 ? 1 : 0;
    }
  }
  return out;
}
