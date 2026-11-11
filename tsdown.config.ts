import { defineConfig } from 'tsdown'

export default defineConfig({
  fixedExtension: false,
  workspace: ['packages/bundle/*', 'packages/client/*', 'packages/sdk/*'],
  format: ['esm'],
  platform: 'node',
  target: 'es2022',
  dts: false,
  clean: false,
})
