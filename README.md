# ClinicalDDI

Privacy-first drug–drug interaction **checker** built with [Next.js](https://nextjs.org). Inference runs **in the browser**: [RDKit](https://www.rdkit.org/) (WASM) for structures/fingerprints, [ONNX Runtime Web](https://onnxruntime.ai/) for `public/fingerprint_model.onnx`.

## Product notes

- **Current path**: structure + fingerprint ONNX (not BioBERT for new runs).
- **History**: stored locally (Dexie); **Export PDF** on the History page bundles all saved checks.
- **Disclaimer**: Outputs are informational; not a regulated clinical decision support replacement.

## Develop

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Use **Checker**, **History**, and **About** from the navbar.

Uses project rules in [`AGENTS.md`](./AGENTS.md) / Next docs under `node_modules/next/dist/docs/` where relevant.
