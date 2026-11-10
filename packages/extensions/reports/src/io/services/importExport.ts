/**
 * 导入导出服务（插件版）
 *
 * 宿主 services/importExportService 的插件侧实现：
 * 解析与导出复用 io/utils 下的纯函数，备份导入/导出走宿主插件 API。
 */
import { useWeekReport } from 'plugin-api'
import { parseImportFile as parseFile } from '../utils/importParsing'
import {
  exportReport as exportReportWithApi,
  exportReports as exportReportsWithApi,
} from '../utils/reportExport'

/**
 * 读取并解析导入文件
 * @param {File} file
 */
export function parseImportFile(file) {
  return parseFile(file)
}

/**
 * 执行导入
 * @returns {Promise<{ reports: number, templates: number, config: number }>}
 */
export function importData(parsed, options) {
  return useWeekReport().data.importBackup(parsed, options)
}

/**
 * 导出全量备份文件
 */
export function exportBackupFile() {
  return useWeekReport().data.exportBackup()
}

/**
 * 导出单份周报
 * @returns {Promise<string>} 导出的文件名
 */
export function exportReport(report, format = 'html') {
  return exportReportWithApi(useWeekReport(), report, format)
}

/**
 * 批量导出
 * @returns {Promise<{ ok: number, fail: number }>}
 */
export function exportReports(reports, format = 'html', options) {
  return exportReportsWithApi(useWeekReport(), reports, format, options)
}
