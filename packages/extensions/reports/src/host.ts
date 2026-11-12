/**
 * 插件内使用的宿主 API：宿主能力 + 周报自己的业务 API。
 * 组件只 import 这里，不直接读 window/全局。
 */
import { useWeekReport as useHostBase } from '@lucky-apps/plugin-api'
import { weekReportApi } from './api'
import { events } from './events'

export function useHost() {
  const host = useHostBase()
  return {
    ...host,
    events: { on: events.on, once: events.once, off: events.off, emit: events.emit },
    reports: weekReportApi.reports,
    templates: weekReportApi.templates,
    config: weekReportApi.config,
    data: weekReportApi.data,
    ui: { ...host.ui, ...weekReportApi.ui },
  }
}

export default useHost
