/**
 * 应用根 Context
 * 所有功能模块以 Cordis 插件形式挂载，服务通过 ctx 注入。
 */
import { Context } from 'cordis'

export const ctx = new Context()
export default ctx
