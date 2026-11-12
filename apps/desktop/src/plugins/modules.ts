/**
 * Client module loader，对应 DSH client-modules 的 staticModules。
 *
 * bundle 通过 window.__ModuleLoader__.load({ id, factory }) 注册 CJS factory；
 * factory 里的 require('vue') 等由这里解析，不把库挂到 window 上。
 */
import * as Vue from 'vue'
import * as ElementPlus from 'element-plus'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import * as ClientUi from '@lucky-apps/client-ui'
import Handlebars from 'handlebars'

const staticModules: Record<string, any> = {
  vue: Vue,
  'element-plus': ElementPlus,
  '@element-plus/icons-vue': ElementPlusIconsVue,
  '@lucky-apps/client-ui': ClientUi,
  handlebars: Handlebars,
}

const factories = new Map<string, (require: (id: string) => any) => any>()
const instances = new Map<string, any>()

export function requireModule(id: string): any {
  if (Object.prototype.hasOwnProperty.call(staticModules, id)) return staticModules[id]
  if (instances.has(id)) return instances.get(id)
  const factory = factories.get(id)
  if (!factory) throw new Error(`[modules] 未注册的模块: ${id}`)
  const exports = factory(requireModule)
  instances.set(id, exports)
  return exports
}

export function loadModule(entry: { id?: string; factory?: (require: (id: string) => any) => any }) {
  if (!entry?.id || typeof entry.factory !== 'function') return
  factories.set(entry.id, entry.factory)
  instances.delete(entry.id)
}

export function instantiateModule(id: string) {
  return requireModule(id)
}

export function installModuleRegistry() {
  ;(window as any).__ModuleLoader__ = {
    load: loadModule,
    require: requireModule,
    staticModules,
  }
}
