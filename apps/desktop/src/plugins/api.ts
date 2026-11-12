/**
 * 宿主能力 API：通过 __ModuleLoader__ 的静态模块 `@lucky-apps/plugin-api` 暴露，
 * client bundle 里 require 同一个模块实例；不挂 window 全局。
 *
 * 只包含宿主通用能力。周报业务 API（reports/templates/config/data）由
 * reports 插件自己提供，通过其 ctx 服务暴露。
 */
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { cordis } from '@/plugins/cordis'
import { dbExecute, dbSelect } from '@/services/rpc'
import { events } from '@/utils/eventBus'
import { useTheme } from '@/composables/useTheme'
import { branding, setBranding } from '@/composables/useBranding'
import { useExtensions } from '@/composables/useExtensions'
import {
  registerComponent,
  registerColumnSlot,
  listComponents,
  listColumnComponents,
  listCanvasComponents,
  hasComponent,
  hasColumnSlot,
  registerNavItem,
  listNavItems,
  registerSettingsSection,
  listSettingsSections,
  registerSidebarPanel,
  listSidebarPanels,
  registerRailAction,
  listRailActions,
  registerOverlay,
  listOverlays,
  extensionState,
  extensionVersion,
} from '@/plugins/registry'

const VERSION = '3.0.0'
const API_VERSION = 2

// ============================================================
// UI 委托：App 启动时注入（导航 / 打开设置）
// ============================================================
let uiImpl = {}

// 当前激活的插件页 id（null = 没有插件页）
const activeView = ref(null)

export function setActiveView(view) {
  activeView.value = view || null
}

export function registerUi(impl = {}) {
  uiImpl = { ...uiImpl, ...impl }
}

function callUi(name, ...args) {
  if (typeof uiImpl[name] !== 'function') return false
  return uiImpl[name](...args)
}

// ============================================================
// 命令
// ============================================================
const commandMap = new Map()

function registerCommand(id, handler, meta = {}) {
  if (typeof id !== 'string' || !id.trim()) throw new Error('command id 不能为空')
  if (typeof handler !== 'function') throw new Error('command handler 必须是函数')
  commandMap.set(id, { id, handler, meta })
  return () => commandMap.delete(id)
}

function listCommands() {
  return [...commandMap.values()].map(({ id, meta }) => ({ id, ...meta }))
}

async function runCommand(id, ...args) {
  const command = commandMap.get(id)
  if (!command) throw new Error(`命令不存在: ${id}`)
  return command.handler(...args)
}

// ============================================================
// 主题
// ============================================================
const theme = useTheme()

const themeApi = {
  modes: theme.modes,
  labels: theme.labels,
  get() {
    return { mode: theme.themeMode.value, resolved: theme.resolvedTheme.value }
  },
  set(mode) {
    theme.setTheme(mode)
  },
  cycle: theme.cycleTheme,
  onChange(fn) {
    return events.on('theme:changed', fn)
  },
}

// ============================================================
// 对外 API
// ============================================================
export const pluginApi = {
  version: VERSION,
  apiVersion: API_VERSION,
  events: {
    on: events.on,
    once: events.once,
    off: events.off,
    emit: events.emit,
  },
  /** 通用 SQL RPC，业务查询归插件自己写 */
  db: {
    select: dbSelect,
    execute: dbExecute,
  },
  components: {
    /** @deprecated 使用 registerColumn / registerCanvas */
    register: (name, component, meta) => registerComponent(name, component, {
      ...meta,
      scope: 'column',
      source: 'plugin',
    }),
    registerColumn: (name, component, meta) => registerComponent(name, component, {
      ...meta,
      scope: 'column',
      source: 'plugin',
    }),
    registerCanvas: (name, component, meta) => registerComponent(name, component, {
      ...meta,
      scope: 'canvas',
      source: 'plugin',
    }),
    registerColumnSlot: (name, component, meta) => registerColumnSlot(name, component, { ...meta, source: 'plugin' }),
    list: listComponents,
    listColumns: listColumnComponents,
    listCanvas: listCanvasComponents,
    has: hasComponent,
    hasColumnSlot,
  },
  navigation: {
    register: registerNavItem,
    list: listNavItems,
    /** 统一跳转：welcome / 插件 nav id */
    open: id => callUi('navigate', id),
  },
  settings: {
    register: registerSettingsSection,
    list: listSettingsSections,
  },
  overlay: {
    register: registerOverlay,
    list: listOverlays,
  },
  sidebar: {
    registerPanel: registerSidebarPanel,
    list: listSidebarPanels,
    registerRailAction,
    listRailActions,
  },
  /** Cordis 扩展生命周期（插件脚本可注册自己的插件） */
  cordis,
  commands: {
    register: registerCommand,
    run: runCommand,
    list: listCommands,
  },
  ui: {
    /** 当前激活的插件页 id（Vue ref） */
    activeView,
    navigate: id => callUi('navigate', id),
    openSettings: () => callUi('openSettings'),
    toast(message, type = 'info') {
      const fn = ElMessage[type]
      if (typeof fn === 'function') fn(message)
      else ElMessage(String(message))
    },
  },
  branding: {
    get: () => ({ ...branding }),
    set: patch => setBranding(patch),
    onChange(fn) {
      return events.on('branding:changed', fn)
    },
  },
  theme: themeApi,
  extensions: {
    list: () => extensionState.resources.map(item => ({ ...item })),
    toggle: id => extensionTools().toggleResource(id),
    rescan: () => extensionTools().rescan(),
    reload: () => extensionTools().hotReloadComponents(),
    /** 组件注册表版本（Vue ref），注册项变化时递增 */
    version: extensionVersion,
    get errors() {
      return [...extensionState.errors]
    },
  },
}

// useExtensions 内部只有 computed 与按需访问的全局状态，可在组件外懒加载
let extensionToolsInstance = null
function extensionTools() {
  extensionToolsInstance ||= useExtensions()
  return extensionToolsInstance
}

export default pluginApi
