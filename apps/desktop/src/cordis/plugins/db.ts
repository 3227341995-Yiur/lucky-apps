/**
 * 通用 SQL RPC 服务。业务表结构和查询归插件自己维护，宿主只提供传输。
 */
import { dbExecute, dbSelect } from '@/services/rpc'

export const name = 'db'

export function apply(ctx) {
  ctx.provide('db', {
    select: dbSelect,
    execute: dbExecute,
  })
}

export default { name, apply }
