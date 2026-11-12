/**
 * 周报业务核心：CRUD + 回收站 + 搜索缓存。
 * 只属于周报插件，宿主不感知。
 */
import {
  loadAllReportsFull,
  saveReport,
  deleteReportById,
  restoreReportById,
  deleteReportPermanently,
  emptyTrash as emptyTrashRows,
  getDataVersion,
} from './database'
import { generateId } from './designer/utils/idGenerator'
import { reportCtx } from './ctx'

export async function createReport(data = {}) {
  const report = {
    id: data.id || generateId(),
    title: data.title || '未命名周报',
    dateRange: data.dateRange || [],
    sections: data.sections || [],
    layout: data.layout || null,
  }
  await saveReport(report)
  reportCtx().emit('report:created', report)
  reportCtx().emit('report:changed', { type: 'created', report })
  return report
}

export async function updateReport(report) {
  if (!report?.id) throw new Error('update 缺少 report.id')
  await saveReport(report)
  reportCtx().emit('report:updated', report)
  reportCtx().emit('report:changed', { type: 'updated', report })
  return report
}

export async function removeReport(id) {
  const changed = await deleteReportById(id)
  if (!changed) throw new Error('周报不存在或已在回收站')
  reportCtx().emit('report:deleted', { id })
  reportCtx().emit('report:changed', { type: 'deleted', id })
  return true
}

export async function restoreReport(id) {
  const changed = await restoreReportById(id)
  if (!changed) throw new Error('回收站中未找到该周报')
  reportCtx().emit('report:restored', { id })
  reportCtx().emit('report:changed', { type: 'restored', id })
  return true
}

export async function purgeReport(id) {
  const changed = await deleteReportPermanently(id)
  if (!changed) throw new Error('回收站中未找到该周报')
  reportCtx().emit('report:purged', { id })
  reportCtx().emit('report:changed', { type: 'purged', id })
  return true
}

export async function emptyTrashReports() {
  const count = await emptyTrashRows()
  reportCtx().emit('report:trash-emptied', { count })
  reportCtx().emit('report:changed', { type: 'trash-emptied', count })
  return count
}

let searchCache = null
let searchCacheVersion = -1

export async function searchReports() {
  const version = getDataVersion()
  if (!searchCache || searchCacheVersion !== version) {
    searchCache = await loadAllReportsFull()
    searchCacheVersion = version
  }
  return searchCache
}
