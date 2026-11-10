import { useWeekReport } from 'plugin-api'

export const getReportConfig = () => useWeekReport().config.get()
export const saveReportConfig = config => useWeekReport().config.set(config)
