/**
 * 插件能力服务：导航、设置面板、组件注册表统一挂到 Cordis Context。
 *
 * 用 Service 类而不是普通对象：通过 ctx 访问服务时 Cordis 会给出调用方视角的
 * proxy，`this.ctx` 就是**调用方插件**的 Context。注册动作包进该插件的
 * `ctx.effect`，插件 dispose 时注册项自动撤销（Cordis 的生命周期形态）。
 * 用 Service 而不是 accessor，是为了保留插件声明式 `inject: ['navigation']`。
 */
import { Service } from 'cordis'
import {
  registerNavItem,
  unregisterNavItem,
  listNavItems,
  registerSettingsSection,
  unregisterSettingsSection,
  listSettingsSections,
  registerComponent,
  unregisterComponent,
  registerColumnSlot,
  unregisterColumnSlot,
  listComponents,
  listColumnComponents,
  listCanvasComponents,
  hasComponent,
  hasColumnSlot,
  registerSidebarPanel,
  unregisterSidebarPanel,
  listSidebarPanels,
  registerRailAction,
  unregisterRailAction,
  listRailActions,
  registerOverlay,
  unregisterOverlay,
  listOverlays,
} from '@/plugins/registry'

export const name = 'registry'

class EffectService extends Service {
  registerEffect(register: () => any, unregister: (entry: any) => void) {
    return this.ctx.effect(() => {
      const entry = register()
      return () => unregister(entry)
    })
  }
}

class NavigationService extends EffectService {
  constructor(ctx: any) {
    super(ctx, 'navigation')
  }

  register(item: any) {
    return this.registerEffect(
      () => registerNavItem(item),
      entry => unregisterNavItem(item.id, entry),
    )
  }

  list() {
    return listNavItems()
  }

  open(id: string) {
    return this.ctx.get('ui')?.navigate(id) ?? false
  }
}

class SettingsService extends EffectService {
  constructor(ctx: any) {
    super(ctx, 'settings')
  }

  register(item: any) {
    return this.registerEffect(
      () => registerSettingsSection(item),
      entry => unregisterSettingsSection(item.id, entry),
    )
  }

  list() {
    return listSettingsSections()
  }
}

class SidebarService extends EffectService {
  constructor(ctx: any) {
    super(ctx, 'sidebar')
  }

  registerPanel(item: any) {
    return this.registerEffect(
      () => registerSidebarPanel(item),
      entry => unregisterSidebarPanel(item.id, entry),
    )
  }

  list() {
    return listSidebarPanels()
  }

  registerRailAction(item: any) {
    return this.registerEffect(
      () => registerRailAction(item),
      entry => unregisterRailAction(item.id, entry),
    )
  }

  listRailActions() {
    return listRailActions()
  }
}

class OverlayService extends EffectService {
  constructor(ctx: any) {
    super(ctx, 'overlay')
  }

  register(item: any) {
    return this.registerEffect(
      () => registerOverlay(item),
      entry => unregisterOverlay(item.id, entry),
    )
  }

  list() {
    return listOverlays()
  }
}

class ComponentsService extends EffectService {
  constructor(ctx: any) {
    super(ctx, 'components')
  }

  register(componentName: string, component: any, meta: any = {}) {
    return this.registerColumn(componentName, component, meta)
  }

  registerColumn(componentName: string, component: any, meta: any = {}) {
    return this.registerEffect(
      () => registerComponent(componentName, component, { ...meta, scope: 'column', source: 'plugin' }),
      entry => unregisterComponent(componentName, entry),
    )
  }

  registerCanvas(componentName: string, component: any, meta: any = {}) {
    return this.registerEffect(
      () => registerComponent(componentName, component, { ...meta, scope: 'canvas', source: 'plugin' }),
      entry => unregisterComponent(componentName, entry),
    )
  }

  registerColumnSlot(componentName: string, component: any, meta: any = {}) {
    return this.registerEffect(
      () => registerColumnSlot(componentName, component, { ...meta, source: 'plugin' }),
      entry => unregisterColumnSlot(componentName, entry),
    )
  }

  list() {
    return listComponents()
  }

  listColumns() {
    return listColumnComponents()
  }

  listCanvas() {
    return listCanvasComponents()
  }

  has(componentName: string) {
    return hasComponent(componentName)
  }

  hasColumnSlot(componentName: string) {
    return hasColumnSlot(componentName)
  }
}

export function apply(ctx: any) {
  new NavigationService(ctx)
  new SettingsService(ctx)
  new SidebarService(ctx)
  new OverlayService(ctx)
  new ComponentsService(ctx)
}

export default { name, apply }
