import { useEffect, useState } from "react";
import type { RDKitModule } from "@rdkit/rdkit";
import { getRDKit } from "@/lib/rdkit-client";

/**
 * Loads @rdkit/rdkit (WASM) once for the tab. WASM is served from /vendor/rdkit (postinstall copy).
 */
export function useRDKit() {
  const [rdkit, setRdkit] = useState<RDKitModule | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const instance = await getRDKit();
        if (!cancelled) setRdkit(instance);
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          setError(
            "RDKit failed to load. Ensure `pnpm install` ran postinstall (copies RDKit_minimal.wasm to public/vendor/rdkit)."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { rdkit, loading, error };
}
