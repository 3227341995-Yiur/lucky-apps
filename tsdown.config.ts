import { defineConfig } from 'tsdown'

export default defineConfig({
  fixedExtension: false,
  workspace: ['packages/core/*'],
  format: ['esm'],
  platform: 'node',
  target: 'es2022',
  dts: false,
  clean: false,
})
