import { defineConfig } from 'tsdown'

export default defineConfig({
  fixedExtension: false,
  "entry": [
    "src/index.ts"
  ],
  "outDir": "lib",
  "format": [
    "esm"
  ],
  "platform": "node",
  "target": "es2022",
  "dts": false,
  "clean": false
})
