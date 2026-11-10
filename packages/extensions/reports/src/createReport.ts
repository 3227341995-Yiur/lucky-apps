/**
 * 新建本周周报：侧栏 rail 的 + 和列表页共用。
 */
import { ElMessage } from 'element-plus'
import { useWeekReport } from 'plugin-api'

export async function createWeekReport() {
  const api = useWeekReport()
  try {
    const now = new Date()
    const day = now.getDay() || 7
    const monday = new Date(now)
    monday.setDate(now.getDate() - (day - 1))
    const friday = new Date(monday)
    friday.setDate(monday.getDate() + 4)
    const format = date => date.toISOString().slice(0, 10)
    const report = await api.reports.create({
      title: `周报 ${format(monday).slice(5)} ~ ${format(friday).slice(5)}`,
      dateRange: [format(monday), format(friday)],
    })
    await api.ui.selectReport(report.id)
    return report
  } catch (error) {
    ElMessage.error(`新建周报失败：${error?.message || error}`)
    return null
  }
}
