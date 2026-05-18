# ClinicalDDI — Model Training

This folder contains the notebook that reproduces the `fingerprint_model.onnx` used in the ClinicalDDI browser app.

## Open in Colab

[![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/gbengaoluwadahunsi/clinicDDI/blob/main/ClinicalDDI/training/fingerprint_model_training.ipynb)

## What the notebook does

| Step | Description |
|------|-------------|
| Cell 1–2 | Install packages and imports |
| Cell 3 | Download DDInter 2.0 CSV files (8 files, ~160k positive pairs) |
| Cell 4 | Build balanced binary dataset (160k positive + 160k synthetic negative) |
| Cell 5 | Fetch canonical SMILES from PubChem for all ~2,000 unique drugs (~20 min) |
| Cell 6 | Compute Morgan fingerprints (radius=2, 1,024 bits) using RDKit |
| Cell 7 | Concatenate fingerprint pairs → 2,048-dim input vectors |
| Cell 8 | 80:20 stratified train/validation split |
| Cell 9 | Train MLP (128 → 64 → 1, ReLU, Adam) |
| Cell 10 | Evaluate: AUROC and accuracy on validation set |
| Cell 11 | Export to ONNX (opset 17) via skl2onnx |
| Cell 12 | Save `drug_smiles.json` for the Next.js frontend |

## Output files

After running all cells, download from the Colab file panel:

- **`fingerprint_model.onnx`** → copy to `public/fingerprint_model.onnx`
- **`drug_smiles.json`** → copy to `public/drug_smiles.json`

## Reported results

| Metric | Value |
|--------|-------|
| Validation AUROC | 0.9611 |
| Validation Accuracy | 89.98% |
| Inference latency (browser, CPU) | ~6.3 ms |
| ONNX model size | ~1 MB |

## Data source

DDInter 2.0 — [https://ddinter2.scbdd.com](https://ddinter2.scbdd.com)  
Xiong et al., *Nucleic Acids Research*, 2022.

SMILES strings fetched from PubChem — [https://pubchem.ncbi.nlm.nih.gov](https://pubchem.ncbi.nlm.nih.gov)
