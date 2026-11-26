/**
 * 新建本周周报的唯一入口：按当前配置生成区块、标题表达式与画布 layout。
 * 侧栏、快捷键和外部插件（如首页）都走这里，不要自己拼 reports.create 参数。
 */
import { ElMessage } from 'element-plus'
import { createReport } from './reports'
import { getReportConfig } from './reportConfigService'
import { createSectionsFromConfig } from './designer/config/defaultReportConfig'
import { extractLayout } from './designer/config/reportLayout'
import { evaluateJsExpression } from './designer/utils/expression'
import { getWeekRange } from './designer/utils/date'
import { useReports } from './useReports'
import { reportCtx } from './ctx'

export async function createWeekReport() {
  try {
    const config = await getReportConfig()
    const sections = createSectionsFromConfig(config.sections)
    const [start, end] = getWeekRange()
    const fallbackTitle = `工作周报 - ${start} ~ ${end}`
    const titleElement = (config.elements || []).find(element => element.type === 'title')
    const title = evaluateJsExpression(
      titleElement?.expression,
      { title: fallbackTitle, dateRange: [start, end], sections },
      fallbackTitle,
    )
    const report = await createReport({
      title,
      dateRange: [start, end],
      sections,
      layout: extractLayout(config),
    })
    await useReports().selectReport(report.id)
    reportCtx().navigation.open('reports')
    return report
  } catch (error) {
    ElMessage.error(`新建周报失败：${error?.message || error}`)
    return null
  }
}
