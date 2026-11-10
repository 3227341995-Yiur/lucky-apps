/**
 * 插件 API v2 - 系统对外部插件暴露的唯一入口
 *
 * window.weekReport
 *   reports   周报 CRUD / 回收站 / 搜索 / 统计
 *   templates 导出模板
 *   config    默认周报结构（低代码配置）
 *   components 运行时注册列组件
 *   commands  命令注册与执行
 *   ui        界面联动（打开周报、设置、导入导出、设计器、提示）
 *   theme     主题读写与订阅
 *   events    系统事件
 *   extensions 扩展资源状态
 */
import { ElMessage } from 'element-plus'
import { cordis } from '@/plugins/cordis'
import {
  loadAllReports,
  loadAllReportsFull,
  loadDeletedReports,
  getReportById,
  saveReport,
  deleteReportById,
  restoreReportById,
  deleteReportPermanently,
  emptyTrash,
  getReportStats,
  getDataVersion,
} from '@/services/database'
import {
  getAllTemplates,
  getTemplateById,
  getDefaultTemplate,
  saveTemplate,
  deleteTemplate,
  setDefaultTemplate,
} from '@/services/templateService'
import {
  getReportConfig,
  saveReportConfig,
  resetReportConfig,
  hasCustomReportConfig,
} from '@/services/reportConfigService'
import { createBackup, exportBackupFile, importData } from '@/services/importExportService'
import { getCopySettings as readCopySettings, saveCopySettings as writeCopySettings } from '@/utils/reportExport'
import { generateId } from '@/utils/idGenerator'
import { events } from '@/utils/eventBus'
import { useTheme } from '@/composables/useTheme'
import { branding, setBranding } from '@/composables/useBranding'
import { useExtensions } from '@/composables/useExtensions'
import {
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
  registerComponent,
  registerColumnSlot,
  listComponents,
  listColumnComponents,
  listCanvasComponents,
  hasComponent,
  extensionState,
} from '@/plugins/registry'

const VERSION = '3.0.0'
const API_VERSION = 2

// ============================================================
// UI 委托：App 启动时注入
// ============================================================
let uiImpl = {}

function registerUi(impl = {}) {
  uiImpl = { ...uiImpl, ...impl }
}

async function callUi(name, ...args) {
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
// 搜索缓存
// ============================================================
let searchCache = null
let searchCacheVersion = -1

async function searchReports() {
  const version = getDataVersion()
  if (!searchCache || searchCacheVersion !== version) {
    searchCache = await loadAllReportsFull()
    searchCacheVersion = version
  }
  return searchCache
}

// ============================================================
// 周报 CRUD / 回收站
// ============================================================
async function createReport(data = {}) {
  const report = {
    id: data.id || generateId(),
    title: data.title || '未命名周报',
    dateRange: data.dateRange || [],
    sections: data.sections || [],
    layout: data.layout || null,
  }
  await saveReport(report)
  events.emit('report:created', report)
  events.emit('report:changed', { type: 'created', report })
  return report
}

async function updateReport(report) {
  if (!report?.id) throw new Error('update 缺少 report.id')
  await saveReport(report)
  events.emit('report:updated', report)
  events.emit('report:changed', { type: 'updated', report })
  return report
}

async function removeReport(id) {
  const changed = await deleteReportById(id)
  if (!changed) throw new Error('周报不存在或已在回收站')
  events.emit('report:deleted', { id })
  events.emit('report:changed', { type: 'deleted', id })
  return true
}

async function restoreReport(id) {
  const changed = await restoreReportById(id)
  if (!changed) throw new Error('回收站中未找到该周报')
  events.emit('report:restored', { id })
  events.emit('report:changed', { type: 'restored', id })
  return true
}

async function purgeReport(id) {
  const changed = await deleteReportPermanently(id)
  if (!changed) throw new Error('回收站中未找到该周报')
  events.emit('report:purged', { id })
  events.emit('report:changed', { type: 'purged', id })
  return true
}

async function emptyTrashReports() {
  const count = await emptyTrash()
  events.emit('report:trash-emptied', { count })
  events.emit('report:changed', { type: 'trash-emptied', count })
  return count
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
  },
  registerUi,
  reports: {
    /** 轻量分页列表（不含 sections） */
    list: params => loadAllReports(params),
    /** 回收站列表 */
    trashed: params => loadDeletedReports(params),
    /** 单条全量（含 sections） */
    get: id => getReportById(id),
    create: createReport,
    update: updateReport,
    remove: removeReport,
    restore: restoreReport,
    purge: purgeReport,
    emptyTrash: emptyTrashReports,
    /** 全量周报（含 sections），供插件搜索 */
    search: searchReports,
    stats: getReportStats,
  },
  templates: {
    list: getAllTemplates,
    get: getTemplateById,
    getDefault: getDefaultTemplate,
    save: saveTemplate,
    remove: deleteTemplate,
    setDefault: setDefaultTemplate,
  },
  config: {
    get: getReportConfig,
    set: saveReportConfig,
    reset: resetReportConfig,
    isCustomized: hasCustomReportConfig,
  },
  data: {
    /** 生成全量备份对象（不下载） */
    createBackup,
    /** 生成并下载全量备份文件 */
    exportBackup: exportBackupFile,
    /** 执行导入：parsed 为解析后的备份对象，options 控制导入范围 */
    importBackup: (parsed, options) => importData(parsed, options),
    /** 复制周报设置（与宿主复制流程共用同一份 DB 配置） */
    copySettings: {
      get: readCopySettings,
      save: writeCopySettings,
    },
  },
  components: {
    /** @deprecated 使用 registerColumn / registerCanvas */
    register: (name, component, meta) => registerComponent(name, component, {
      ...meta,
      scope: 'column',
      source: 'plugin',
    }),
    /** 注册列组件（表格单元格） */
    registerColumn: (name, component, meta) => registerComponent(name, component, {
      ...meta,
      scope: 'column',
      source: 'plugin',
    }),
    /** 注册画布组件（自由画布拖拽） */
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
  },
  navigation: {
    register: registerNavItem,
    list: listNavItems,
    /** 统一跳转：welcome / reports / 外部 nav id */
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
    /** 选中并打开一条周报 */
    selectReport: id => callUi('selectReport', id),
    toast(message, type = 'info') {
      const fn = ElMessage[type]
      if (typeof fn === 'function') fn(message)
      else ElMessage(String(message))
    },
    openSettings: () => callUi('openSettings'),
    openImportExport: () => callUi('openImportExport'),
    openDesigner: () => callUi('openDesigner'),
    openTemplates: () => callUi('openTemplates'),
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

// 插件脚本在扩展加载阶段即可访问；装配期重复赋值无副作用
if (typeof window !== 'undefined') {
  window.weekReport = pluginApi
  window.__WEEK_REPORT_HOST__ = pluginApi
}

export default pluginApi
