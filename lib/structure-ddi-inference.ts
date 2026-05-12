import * as ort from "onnxruntime-web";
import type { RDKitModule } from "@rdkit/rdkit";
import { getMorganCached } from "./fingerprint";
import { tanimotoSimilarity } from "./rdkit-client";

const N_BITS = 1024;
const FP_RADIUS = 2;

export type FingerprintBinaryHead = "logit" | "probability";

let fpSingleOutputMode: FingerprintBinaryHead = "logit";

/** Call after reading `model-manifest.json` if your ONNX ends with Sigmoid (already a probability). */
export function setFingerprintBinaryHead(mode: FingerprintBinaryHead): void {
  fpSingleOutputMode = mode;
}

/** Try Colab-export name first, then project default. */
const FP_MODEL_CANDIDATES = ["/fingerprint_model.onnx", "/ddi_fingerprint.onnx"];

export type StructureInferenceResult =
  | {
      kind: "model";
      logits: Float32Array;
      latencyMs: number;
      smiles1: string;
      smiles2: string;
      tanimoto: number;
    }
  | {
      kind: "similarity_only";
      tanimoto: number;
      smiles1: string;
      smiles2: string;
      message: string;
    };

let fpSession: ort.InferenceSession | null | undefined;

export async function getFingerprintSession(): Promise<ort.InferenceSession | null> {
  if (fpSession !== undefined) return fpSession;
  for (const url of FP_MODEL_CANDIDATES) {
    try {
      fpSession = await ort.InferenceSession.create(url, { executionProviders: ["wasm"] });
      return fpSession;
    } catch {
      /* try next candidate */
    }
  }
  fpSession = null;
  return null;
}

function softmax(logits: Float32Array): number[] {
  const maxLogit = Math.max(...logits);
  const exp = [...logits].map((v) => Math.exp(v - maxLogit));
  const sum = exp.reduce((a, b) => a + b, 0);
  return exp.map((v) => v / sum);
}

/** Prefer logits-like names; many exports include extra non-tensor outputs. */
function rankOutputNames(names: readonly string[]): string[] {
  const score = (n: string) => {
    let s = 0;
    if (/logit/i.test(n)) s += 120;
    if (/prob/i.test(n)) s += 100;
    if (/pred/i.test(n)) s += 90;
    if (/output/i.test(n)) s += 70;
    if (/score/i.test(n)) s += 60;
    if (/dense/i.test(n)) s += 40;
    if (/label/i.test(n)) s += 30;
    if (/class/i.test(n)) s += 25;
    return s;
  };
  return [...names].sort((a, b) => score(b) - score(a));
}

function toFloat32FromTensorData(d: ArrayBufferView | ArrayLike<number>): Float32Array {
  if (d instanceof Float32Array) return d.slice();
  if (d instanceof Float64Array) return Float32Array.from(d as ArrayLike<number>);
  if (d instanceof Int32Array || d instanceof Int16Array || d instanceof Uint8Array || d instanceof Int8Array) {
    return Float32Array.from(d as ArrayLike<number>);
  }
  if (d instanceof Uint16Array || d instanceof Uint32Array) return Float32Array.from(d as ArrayLike<number>);
  if (d instanceof BigInt64Array || d instanceof BigUint64Array) {
    return Float32Array.from(d, (bi) => Number(bi));
  }
  const like = d as ArrayLike<number>;
  return Float32Array.from({ length: like.length ?? 0 }, (_, i) => Number(like[i]));
}

async function tensorToFloat32(t: ort.Tensor): Promise<Float32Array> {
  try {
    return toFloat32FromTensorData(t.data as ArrayBufferView);
  } catch {
    const d = await t.getData();
    if (Array.isArray(d)) {
      throw new Error("String or sequence outputs are not supported for the fingerprint classifier");
    }
    return toFloat32FromTensorData(d as ArrayBufferView);
  }
}

/**
 * Read classifier logits: use `run(feeds, [name])` first so ORT does not materialize
 * auxiliary outputs (maps/sequences) that error with "Reading data from non-tensor".
 */
async function readPrimaryLogits(session: ort.InferenceSession, feeds: Record<string, ort.Tensor>): Promise<Float32Array> {
  const names = rankOutputNames(session.outputNames);
  if (names.length === 0) {
    throw new Error("ONNX model has no outputs");
  }

  let lastErr: Error | null = null;

  for (const name of names) {
    try {
      const partial = await session.run(feeds, [name]);
      const v = partial[name];
      if (!v) continue;
      if (!(v instanceof ort.Tensor)) {
        lastErr = new Error(`Output "${name}" is not a dense tensor`);
        continue;
      }
      return await tensorToFloat32(v);
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
    }
  }

  throw lastErr ?? new Error(
    "Could not read classifier logits from this ONNX graph. Prefer a single float output named e.g. logits/output, or list only that output when exporting."
  );
}

/**
 * Run structure pathway: Morgan FP via RDKit, optional ONNX classifier.
 * Ships without ONNX by default → similarity_only until you add `public/ddi_fingerprint.onnx`.
 */
export async function inferStructureDdi(
  rdkit: RDKitModule,
  smiles1: string,
  smiles2: string
): Promise<StructureInferenceResult> {
  const c1 = getMorganCached(rdkit, smiles1, FP_RADIUS, N_BITS);
  const c2 = getMorganCached(rdkit, smiles2, FP_RADIUS, N_BITS);
  if (!c1 || !c2) {
    return {
      kind: "similarity_only",
      tanimoto: 0,
      smiles1,
      smiles2,
      message: "Invalid SMILES — RDKit could not parse one or both structures.",
    };
  }

  const tanimoto = tanimotoSimilarity(c1.packed, c2.packed);

  const session = await getFingerprintSession();
  if (!session) {
    return {
      kind: "similarity_only",
      tanimoto,
      smiles1,
      smiles2,
      message:
        "No fingerprint ONNX found (try `public/fingerprint_model.onnx` or `public/ddi_fingerprint.onnx`). Structure path shows validated SMILES and Tanimoto similarity only; add a trained MLP for class probabilities.",
    };
  }

  const combined = new Float32Array(c1.float.length + c2.float.length);
  combined.set(c1.float, 0);
  combined.set(c2.float, c1.float.length);

  const inputName = session.inputNames[0];
  const feeds: Record<string, ort.Tensor> = {};
  feeds[inputName] = new ort.Tensor("float32", combined, [1, combined.length]);

  const t0 = performance.now();
  let logits: Float32Array;
  try {
    logits = await readPrimaryLogits(session, feeds);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      kind: "similarity_only",
      tanimoto,
      smiles1,
      smiles2,
      message: `Fingerprint ONNX inference failed while reading outputs (${msg}). If your model has multiple outputs, re-export with a single logits output or name it "logits" / "output".`,
    };
  }
  const latencyMs = Math.round(performance.now() - t0);

  return {
    kind: "model",
    logits: logits.slice(0),
    latencyMs,
    smiles1,
    smiles2,
    tanimoto,
  };
}

export function probsFromStructureResult(res: StructureInferenceResult): [number, number, number] | null {
  if (res.kind !== "model") return null;
  const data = res.logits;
  if (data.length >= 3) {
    const p = softmax(data);
    return [p[0], p[1], p[2]] as [number, number, number];
  }
  if (data.length === 1) {
    const raw = data[0];
    const p =
      fpSingleOutputMode === "probability"
        ? Math.min(1, Math.max(0, raw))
        : 1 / (1 + Math.exp(-raw));
    return [1 - p, 0, p];
  }
  if (data.length === 2) {
    const p = softmax(data);
    return [p[0], p[1], 0];
  }
  return null;
}
