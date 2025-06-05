import { defineConfig } from "tsdown"

export default defineConfig({
  dts: true,
  entry: {
    "monorepo-hash": "./src/monorepo-hash.ts",
  },
  exports: true,
  format: [ "cjs", "esm" ],
  minify: true,
  platform: "node",
  shims: true,
  target: [ "esnext", "node20" ],
  unused: true,
})
