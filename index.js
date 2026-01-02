#!/usr/bin/env node
// This file is kept for backward compatibility. The modern CLI lives in dist/cli.js after build.
import('./dist/cli.js').catch((err) => {
  console.error('Failed to load built CLI. Try running `npm run build` or `npm run dev`:', err);
  process.exit(1);
});
