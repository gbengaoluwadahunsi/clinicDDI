import type { NextConfig } from "next";
import path from "path";

// Turbopack browser aliases must be project-relative POSIX paths (not absolute Windows paths).
const nodeStubRel = "./lib/shims/node-stub.cjs";
const nodeStubAbs = path.join(process.cwd(), nodeStubRel);

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(process.cwd()),
    // RDKit_minimal.js includes require("fs") / require("crypto") for Emscripten's Node path;
    // browser builds never run that branch — stub only for the browser graph.
    resolveAlias: {
      fs: { browser: nodeStubRel },
      crypto: { browser: nodeStubRel },
    },
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: nodeStubAbs,
        crypto: nodeStubAbs,
      };
    }
    return config;
  },
  serverExternalPackages: ["@rdkit/rdkit"],
};

export default nextConfig;
