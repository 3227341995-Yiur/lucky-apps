import { weekReportApi } from '../api'

export const getReportConfig = () => weekReportApi.config.get()
export const saveReportConfig = config => weekReportApi.config.set(config)
