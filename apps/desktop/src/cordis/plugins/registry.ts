/**
 * 插件能力服务：导航、设置面板、组件注册表统一挂到 Cordis Context。
 * 外部组件在 apply(ctx) 里用 ctx.navigation / ctx.settings / ctx.components。
 */
import {
  registerNavItem,
  listNavItems,
  registerSettingsSection,
  listSettingsSections,
  registerComponent,
  registerColumnSlot,
  listComponents,
  listColumnComponents,
  listCanvasComponents,
  hasComponent,
  registerSidebarPanel,
  listSidebarPanels,
  registerRailAction,
  listRailActions,
  registerOverlay,
  listOverlays,
} from '@/plugins/registry'

export const name = 'registry'

export function apply(ctx) {
  ctx.provide('navigation', {
    register: registerNavItem,
    list: listNavItems,
  })
  ctx.provide('settings', {
    register: registerSettingsSection,
    list: listSettingsSections,
  })
  ctx.provide('sidebar', {
    registerPanel: registerSidebarPanel,
    list: listSidebarPanels,
    registerRailAction,
    listRailActions,
  })
  ctx.provide('overlay', {
    register: registerOverlay,
    list: listOverlays,
  })
  ctx.provide('components', {
    register: (name, component, meta) => registerComponent(name, component, { ...meta, scope: 'column', source: 'plugin' }),
    registerColumn: (name, component, meta) => registerComponent(name, component, { ...meta, scope: 'column', source: 'plugin' }),
    registerCanvas: (name, component, meta) => registerComponent(name, component, { ...meta, scope: 'canvas', source: 'plugin' }),
    registerColumnSlot: (name, component, meta) => registerColumnSlot(name, component, { ...meta, source: 'plugin' }),
    list: listComponents,
    listColumns: listColumnComponents,
    listCanvas: listCanvasComponents,
    has: hasComponent,
  })
}

export default { name, apply }
