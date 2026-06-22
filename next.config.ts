import type { NextConfig } from 'next';
import path from 'path';

const config: NextConfig = {
  // These packages use ESM or non-standard exports — let Next.js bundle them
  transpilePackages: ['remotion', '@remotion/player', '@remotion/core', 'culori', 'chroma-js'],
  turbopack: {
    // Resolve ambiguity when multiple lockfiles exist above the project root
    root: path.resolve(__dirname),
  },
};

export default config;
