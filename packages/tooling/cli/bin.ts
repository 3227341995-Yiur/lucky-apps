#!/usr/bin/env node
import { run } from './src/index.ts'

run(process.argv.slice(2)).catch((error) => {
  console.error(`[lucky-apps] ${error.message}`)
  process.exitCode = 1
})
