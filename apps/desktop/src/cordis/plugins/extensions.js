import { extensionState } from '@/plugins/registry'
import {
  loadExtensionResources,
  scanExtensionResources,
  reloadExtensionComponents,
  startExtensionWatcher
} from '@/plugins/loader'
import { installExtensions } from '@/plugins'

export const name = 'extensions'

export function apply(ctx) {
  ctx.provide('extensions', {
    state: extensionState,
    install: installExtensions,
    scan: scanExtensionResources,
    reload: reloadExtensionComponents,
    startWatcher: startExtensionWatcher,
    load: loadExtensionResources
  })
}

export default { name, apply }
