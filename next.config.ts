import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Pins the workspace root explicitly — without this, Turbopack can infer
  // the wrong root if a stray lockfile exists higher up the filesystem.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
