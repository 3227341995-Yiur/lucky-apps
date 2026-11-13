import { extensionState, extensionVersion } from '@/plugins/registry'
import {
  loadExtensionResources,
  scanExtensionResources,
  reloadExtensionComponents,
  startExtensionWatcher,
} from '@/plugins/loader'
import { installExtensions } from '@/plugins'
import { useExtensions } from '@/composables/useExtensions'

export const name = 'extensions'

export function apply(ctx) {
  const tools = useExtensions()

  ctx.provide('extensions', {
    state: extensionState,
    /** 组件注册表版本（Vue ref），注册项变化时递增 */
    version: extensionVersion,
    list: () => extensionState.resources.map(item => ({ ...item })),
    toggle: (id, enabled) => tools.toggleResource(id, enabled),
    rescan: () => tools.rescan(),
    get errors() {
      return [...extensionState.errors]
    },
    install: installExtensions,
    scan: scanExtensionResources,
    reload: reloadExtensionComponents,
    startWatcher: startExtensionWatcher,
    load: loadExtensionResources,
  })
}

export default { name, apply }
