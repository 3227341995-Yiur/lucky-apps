import { useHost } from '../host.ts'

export const getReportConfig = () => useHost().config.get()
export const saveReportConfig = config => useHost().config.set(config)
