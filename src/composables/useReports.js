/**
 * 周报全局状态（Vue 官方组合式函数，模块级单例）
 *
 * App、侧栏、Welcome、回收站、导入导出共用同一份状态，
 * 所有写操作经插件 API 走同一条路径并触发 report:changed，列表自动刷新。
 */
import { computed, reactive } from 'vue'
import { ElMessage } from 'element-plus'
import { pluginApi } from '@/plugins/api'
import {
  loadAllReports,
  loadDeletedReports,
  loadReportSections,
  getReportById,
  getReportStats,
  getRecentReports,
  saveReport
} from '@/services/database'
import { ensureDefaultTemplate } from '@/services/templateService'
import { getReportConfig } from '@/services/reportConfigService'
import { evaluateJsExpression } from '@/utils/expression'
import {
  createSectionsFromConfig,
  createRow,
  normalizeReportConfig,
  cloneConfig
} from '@/config/defaultReportConfig'
import { extractLayout } from '@/config/reportLayout'
import { extensionState } from '@/plugins/registry'
import { generateId } from '@/utils/idGenerator'
import { getWeekRange } from '@/utils/date'

const state = reactive({
  initialized: false,
  initializing: false,
  loading: false,
  reports: [],
  hasMore: true,
  pageSize: 12,
  pageOffset: 0,
  currentId: null,
  currentReport: null,
  stats: {
    reports: 0,
    workItems: 0,
    trash: 0,
    templates: 0,
    extensions: 0
  },
  recentReports: [],
  trash: [],
  trashLoading: false,
  view: 'reports',
  lastSavedAt: 0
})

let subscribed = false
let injectedReport = null
let reportsLoadPromise = null

// 已移入回收站的周报：丢弃切换瞬间仍在防抖队列里的自动保存，避免“已在回收站”报错
const ignoredSaveIds = new Set()

function toListReport(report) {
  return {
    id: report.id,
    title: report.title,
    dateRange: report.dateRange || [],
    sections: [],
    created_at: report.created_at,
    updated_at: report.updated_at
  }
}

function dedupeReports(list) {
  const seen = new Set()
  return list.filter(report => {
    if (seen.has(report.id)) return false
    seen.add(report.id)
    return true
  })
}

async function loadReports(append = false) {
  // 并发加载共用同一个 promise，避免一个调用提前返回后拿到旧列表
  if (reportsLoadPromise) return reportsLoadPromise

  reportsLoadPromise = (async () => {
    state.loading = true
    try {
      const offset = append ? state.pageOffset : 0
      const rows = await loadAllReports({ limit: state.pageSize, offset })

      if (append) {
        if (injectedReport && rows.some(report => report.id === injectedReport.id)) {
          removeInjectedReport()
        }
        const known = new Set(state.reports.map(report => report.id))
        state.reports = dedupeReports([
          ...state.reports,
          ...rows.filter(report => !known.has(report.id))
        ])
        state.pageOffset += rows.length
      } else {
        injectedReport = null
        state.reports = dedupeReports(rows)
        state.pageOffset = rows.length
        await ensureCurrentInList()
      }

      state.hasMore = rows.length === state.pageSize
    } finally {
      state.loading = false
    }
  })()

  try {
    return await reportsLoadPromise
  } finally {
    reportsLoadPromise = null
  }
}

async function ensureCurrentInList() {
  if (state.currentId == null) return
  if (state.reports.some(report => report.id === state.currentId)) return

  const current = await getReportById(state.currentId)
  if (!current) return
  // 等待数据库期间列表可能已被另一次加载更新
  if (state.reports.some(report => report.id === current.id)) return

  const item = toListReport(current)
  state.reports.unshift(item)
  injectedReport = item
}

function removeInjectedReport() {
  if (!injectedReport) return
  state.reports = state.reports.filter(report => report !== injectedReport)
  injectedReport = null
}

async function selectReport(id) {
  if (id == null) return null
  if (injectedReport && injectedReport.id !== id) {
    removeInjectedReport()
  }
  state.reports = dedupeReports(state.reports)

  const previousId = state.currentId
  state.currentId = id
  state.view = 'reports'

  let report = state.reports.find(item => item.id === id)

  if (!report) {
    report = await getReportById(id)
    if (!report) {
      state.currentId = previousId
      return null
    }
    if (!state.reports.some(item => item.id === id)) {
      const item = toListReport(report)
      state.reports.unshift(item)
      injectedReport = item
    }
    report = { ...report, sections: report.sections || [] }
  } else if (!report.sections?.length) {
    report = { ...report, sections: await loadReportSections(id) }
    const index = state.reports.findIndex(item => item.id === id)
    if (index !== -1) state.reports[index] = { ...state.reports[index], ...toListReport(report) }
  }

  state.currentReport = report
  return report
}

function clearCurrent() {
  state.currentId = null
  state.currentReport = null
}

async function createReport() {
  const config = await getReportConfig()
  const sections = createSectionsFromConfig(config.sections)
  const [start, end] = getWeekRange()
  const fallbackTitle = `工作周报 - ${start} ~ ${end}`
  const titleElement = (config.elements || []).find(element => element.type === 'title')
  const title = evaluateJsExpression(
    titleElement?.expression,
    { title: fallbackTitle, dateRange: [start, end], sections },
    fallbackTitle
  )

  const report = await pluginApi.reports.create({
    id: generateId(),
    title,
    dateRange: [start, end],
    sections,
    layout: extractLayout(config)
  })

  await loadReports(false)
  await selectReport(report.id)
  await refreshStats()
  return report
}

/**
 * 保存指定周报快照
 * 防抖保存时必须绑定快照：用户快速切换周报时，旧周报的待保存内容不能写到新周报上
 */
async function saveReportSnapshot(report) {
  if (!report?.id) return false
  if (ignoredSaveIds.has(report.id)) return false
  try {
    await saveReport(report)
    state.lastSavedAt = Date.now()
    const index = state.reports.findIndex(item => item.id === report.id)
    if (index !== -1) {
      state.reports[index] = {
        ...state.reports[index],
        title: report.title,
        dateRange: report.dateRange,
        updated_at: state.lastSavedAt
      }
    }
    if (state.currentReport?.id === report.id) {
      state.currentReport.title = report.title
    }
    return true
  } catch (error) {
    ElMessage.error(error?.message || '保存失败')
    return false
  }
}

async function saveCurrent() {
  return saveReportSnapshot(state.currentReport)
}

async function deleteReport(id) {
  ignoredSaveIds.add(id)
  try {
    await pluginApi.reports.remove(id)
  } catch (error) {
    ignoredSaveIds.delete(id)
    throw error
  }
}

async function refreshStats() {
  try {
    const dbStats = await getReportStats()
    state.stats = {
      ...dbStats,
      extensions: extensionState.resources.filter(item => item.enabled).length
    }
  } catch (error) {
    console.error('[reports] 刷新统计失败:', error)
  }
}

async function loadRecent() {
  try {
    state.recentReports = await getRecentReports(6)
  } catch (error) {
    console.error('[reports] 加载最近周报失败:', error)
  }
}

async function loadTrash() {
  state.trashLoading = true
  try {
    state.trash = await loadDeletedReports({ limit: 200, offset: 0 })
  } finally {
    state.trashLoading = false
  }
}

async function restoreReport(id) {
  ignoredSaveIds.delete(id)
  await pluginApi.reports.restore(id)
  await loadReports(false)
  await loadTrash()
  await refreshStats()
  await selectReport(id)
}

async function purgeReport(id) {
  await pluginApi.reports.purge(id)
  await loadTrash()
  await refreshStats()
}

async function emptyTrash() {
  const count = await pluginApi.reports.emptyTrash()
  await loadTrash()
  await refreshStats()
  return count
}

async function refreshAll() {
  await Promise.all([loadReports(false), refreshStats(), loadRecent()])
  if (state.trash.length > 0 || state.view === 'trash') await loadTrash()
}

async function handleReportChanged(payload) {
  await Promise.all([loadReports(false), refreshStats(), loadRecent()])
  if (state.view === 'trash') await loadTrash()

  const currentStillExists = state.reports.some(report => report.id === state.currentId)
  if (payload?.type === 'deleted' && payload.id === state.currentId) {
    if (state.reports.length > 0) await selectReport(state.reports[0].id)
    else clearCurrent()
    return
  }
  if (payload?.type === 'purged' && payload.id === state.currentId) {
    if (state.reports.length > 0) await selectReport(state.reports[0].id)
    else clearCurrent()
    return
  }
  if (payload?.type === 'updated' && payload.report?.id === state.currentId) {
    // 插件更新了当前周报：同步内容，避免界面显示旧数据
    const updated = await getReportById(state.currentId)
    if (updated) state.currentReport = updated
    return
  }
  if (!currentStillExists && state.currentId != null) {
    const current = await getReportById(state.currentId)
    if (!current) clearCurrent()
  }
}

function setView(view) {
  state.view = view
  if (view === 'trash') loadTrash()
}

/**
 * 将低代码结构应用到当前周报：同 type 的区块保留原有数据行
 */
async function applyConfigToCurrent(config) {
  if (!state.currentReport) throw new Error('请先打开一份周报')
  const nextSections = normalizeReportConfig(config.sections || config)
  const oldSections = state.currentReport.sections || []

  state.currentReport.sections = nextSections.map(section => {
    const previous = oldSections.find(item => item.type === section.type)
    return {
      ...cloneConfig(section),
      items: previous?.items?.length ? cloneConfig(previous.items) : [createRow(section.columns)]
    }
  })
  state.currentReport.layout = extractLayout(config)
  await saveCurrent()
}

async function init() {
  if (state.initialized || state.initializing) return
  state.initializing = true

  try {
    await ensureDefaultTemplate()
    await Promise.all([loadReports(false), refreshStats(), loadRecent()])

    if (!subscribed) {
      pluginApi.events.on('report:changed', payload => {
        handleReportChanged(payload).catch(error => console.error('[reports] 刷新失败:', error))
      })
      subscribed = true
    }

    pluginApi.registerUi({
      selectReport,
      openSettings: () => callUiHook('openSettings'),
      openImportExport: () => callUiHook('openImportExport'),
      openDesigner: () => callUiHook('openDesigner'),
      openTemplates: () => callUiHook('openTemplates')
    })

    state.initialized = true
  } catch (error) {
    console.error('[reports] 初始化失败:', error)
    ElMessage.error(`初始化失败: ${error?.message || error}`)
  } finally {
    state.initializing = false
  }
}

// App 可注册额外的 UI 钩子（设置/导入导出/设计器/模板），插件通过 API 触发
let uiHooks = {}
function registerUiHooks(hooks) {
  uiHooks = { ...uiHooks, ...hooks }
}
function callUiHook(name) {
  return uiHooks[name]?.()
}

const counts = computed(() => ({
  reports: state.stats.reports,
  workItems: state.stats.workItems,
  trash: state.stats.trash,
  templates: state.stats.templates,
  extensions: state.stats.extensions
}))

export function useReports() {
  return {
    state,
    counts,
    init,
    loadReports,
    selectReport,
    clearCurrent,
    createReport,
    saveCurrent,
    saveReportSnapshot,
    deleteReport,
    refreshStats,
    refreshAll,
    loadRecent,
    loadTrash,
    restoreReport,
    purgeReport,
    emptyTrash,
    setView,
    applyConfigToCurrent,
    registerUiHooks
  }
}

export default useReports
