/**
 * Copy RDKit WASM to /public so Next can serve it (offline-friendly after first load).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const srcDir = path.join(root, "node_modules", "@rdkit", "rdkit", "dist");
const destDir = path.join(root, "public", "vendor", "rdkit");

if (!fs.existsSync(srcDir)) {
  console.warn("scripts/copy-rdkit-wasm.mjs: @rdkit/rdkit dist not found, skip");
  process.exit(0);
}
fs.mkdirSync(destDir, { recursive: true });
for (const f of ["RDKit_minimal.wasm"]) {
  const from = path.join(srcDir, f);
  const to = path.join(destDir, f);
  if (fs.existsSync(from)) {
    fs.copyFileSync(from, to);
    console.log("copied", f, "→ public/vendor/rdkit/");
  }
}
