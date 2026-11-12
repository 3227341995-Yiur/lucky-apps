import { useWeekReport as useHost } from '@lucky-apps/plugin-api'

export const getReportConfig = () => useHost().config.get()
export const saveReportConfig = config => useHost().config.set(config)
