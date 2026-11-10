/**
 * 周报插件内的三个弹窗（保持原周报系统里的形态）：
 * 导入导出 / 模板设计 / 周报设计。
 */
import { reactive } from 'vue'

export type ReportsDialog = 'io' | 'template' | 'designer'

export const dialogState = reactive<Record<ReportsDialog, boolean>>({
  io: false,
  template: false,
  designer: false,
})

export function openReportsDialog(name: ReportsDialog) {
  dialogState[name] = true
}
