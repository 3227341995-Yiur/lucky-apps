import { defineConfig } from 'tsdown'
import { clientConfig } from '../tsdown.client.ts'

export default defineConfig(clientConfig({ name: "@lucky-apps/extension-kpi-card", root: import.meta.dirname }))
