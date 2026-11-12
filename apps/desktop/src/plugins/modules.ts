/**
 * Client module loader，对应 DSH client-modules 的 staticModules。
 *
 * bundle 通过 window.__ModuleLoader__.load({ id, factory }) 注册 CJS factory；
 * factory 里的 require('vue') 等由这里解析，不把库挂到 window 上。
 */
import * as Vue from 'vue'
import * as ElementPlus from 'element-plus'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import Handlebars from 'handlebars'

const staticModules: Record<string, any> = {
  vue: Vue,
  'element-plus': ElementPlus,
  '@element-plus/icons-vue': ElementPlusIconsVue,
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

/** 宿主能力作为静态模块提供给插件：client bundle 里 require('@lucky-apps/plugin-api')
 *  直接拿到宿主实现的模块，不挂 window 全局、也不把 SDK 打进每个插件。 */
export function installModuleRegistry(hostApi) {
  const sdk = {
    ...hostApi,
    definePlugin: plugin => plugin,
    useHost: () => hostApi,
    useWeekReport: () => hostApi,
  }
  sdk.default = sdk
  staticModules['@lucky-apps/plugin-api'] = sdk
  ;(window as any).__ModuleLoader__ = {
    load: loadModule,
    require: requireModule,
    staticModules,
  }
}
