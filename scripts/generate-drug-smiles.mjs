/**
 * One-off / CI-optional: fill lib/drug-smiles.json from PubChem (network).
 * Run: node scripts/generate-drug-smiles.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const descPath = path.join(root, "lib", "drug-descriptions.json");
const outPath = path.join(root, "lib", "drug-smiles.json");

const descriptions = JSON.parse(fs.readFileSync(descPath, "utf8"));
const names = Object.keys(descriptions);
const out = {};
const failed = [];

for (const name of names) {
  const url = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(name)}/property/IsomericSMILES/JSON`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      failed.push(name);
      continue;
    }
    const data = await res.json();
    const smi = data?.PropertyTable?.Properties?.[0]?.SMILES || data?.PropertyTable?.Properties?.[0]?.ConnectivitySMILES;
    if (typeof smi === "string" && smi.length > 1) {
      out[name.toLowerCase()] = smi;
    } else {
      failed.push(name);
    }
  } catch {
    failed.push(name);
  }
  await new Promise((r) => setTimeout(r, 120));
}

fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
console.log(`Wrote ${Object.keys(out).length} entries to lib/drug-smiles.json`);
if (failed.length) console.log("Missing / failed:", failed.join(", "));
