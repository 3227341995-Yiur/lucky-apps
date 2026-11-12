/**
 * 周报插件对外 API（由插件自己提供，宿主不再实现）。
 *
 * 通过 ctx.provide('weekReport', ...) 挂到 Cordis，组件和外部插件都走这里。
 * 宿主能力（主题、品牌、扩展状态、事件总线等）从 Cordis ctx 服务取。
 */
import { ElMessage } from 'element-plus'
import { reportCtx } from './ctx'
import {
  createReport,
  updateReport,
  removeReport,
  restoreReport,
  purgeReport,
  emptyTrashReports,
  searchReports,
} from './reports'
import {
  loadAllReports,
  loadDeletedReports,
  getReportById,
  getReportStats,
} from './database'
import {
  getAllTemplates,
  getTemplateById,
  getDefaultTemplate,
  saveTemplate,
  deleteTemplate,
  setDefaultTemplate,
} from './template/services/templateService'
import {
  getReportConfig,
  saveReportConfig,
  resetReportConfig,
  hasCustomReportConfig,
} from './reportConfigService'
import { createBackup, exportBackupFile, importData } from './io/services/importExport'
import { getCopySettings, saveCopySettings } from './reportExport'
import { useReports } from './useReports'
import { openReportsDialog } from './dialogs'

export const weekReportApi = {
  events: {
    on: (event, listener) => reportCtx().on(event, listener),
    emit: (event, ...args) => reportCtx().emit(event, ...args),
  },
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
    createBackup,
    exportBackup: exportBackupFile,
    importBackup: (parsed, options) => importData(parsed, options),
    copySettings: {
      get: getCopySettings,
      save: saveCopySettings,
    },
  },
  ui: {
    selectReport: async (id) => {
      const report = await useReports().selectReport(id)
      reportCtx().navigation.open('reports')
      return report
    },
    currentReportId: () => useReports().state.currentId ?? null,
    /** 宿主当前激活页是不是周报页 */
    isReportsVisible: () => reportCtx().ui.activeView?.value === 'reports',
    openSettings: () => reportCtx().ui.openSettings(),
    openImportExport: () => openReportsDialog('io'),
    openDesigner: () => openReportsDialog('designer'),
    openTemplates: () => openReportsDialog('template'),
    toast(message, type = 'info') {
      const fn = ElMessage[type]
      if (typeof fn === 'function') fn(message)
      else ElMessage(String(message))
    },
  },
}

export default weekReportApi
