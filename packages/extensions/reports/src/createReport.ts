/**
 * 新建本周周报：与宿主原逻辑一致——按默认配置生成区块、标题表达式与画布 layout。
 */
import { ElMessage } from 'element-plus'
import { weekReportApi } from './api'
import { createSectionsFromConfig } from './designer/config/defaultReportConfig'
import { extractLayout } from './designer/config/reportLayout'
import { evaluateJsExpression } from './designer/utils/expression'

function weekRange(base = new Date()) {
  const day = base.getDay() || 7
  const monday = new Date(base)
  monday.setDate(base.getDate() - (day - 1))
  const friday = new Date(monday)
  friday.setDate(monday.getDate() + 4)
  const format = date => date.toISOString().slice(0, 10)
  return [format(monday), format(friday)]
}

export async function createWeekReport() {
  const api = weekReportApi
  try {
    const config = await api.config.get()
    const sections = createSectionsFromConfig(config.sections)
    const [start, end] = weekRange()
    const fallbackTitle = `工作周报 - ${start} ~ ${end}`
    const titleElement = (config.elements || []).find(element => element.type === 'title')
    const title = evaluateJsExpression(
      titleElement?.expression,
      { title: fallbackTitle, dateRange: [start, end], sections },
      fallbackTitle,
    )
    const report = await api.reports.create({
      title,
      dateRange: [start, end],
      sections,
      layout: extractLayout(config),
    })
    await api.ui.selectReport(report.id)
    return report
  } catch (error) {
    ElMessage.error(`新建周报失败：${error?.message || error}`)
    return null
  }
}
