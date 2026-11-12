/**
 * 命令服务：插件通过 ctx.commands 注册/执行命令。
 */
export const name = 'commands'

export function apply(ctx) {
  const commands = new Map()

  ctx.provide('commands', {
    register(id, handler, meta = {}) {
      if (typeof id !== 'string' || !id.trim()) throw new Error('command id 不能为空')
      if (typeof handler !== 'function') throw new Error('command handler 必须是函数')
      commands.set(id, { id, handler, meta })
      return () => commands.delete(id)
    },
    list() {
      return [...commands.values()].map(({ id, meta }) => ({ id, ...meta }))
    },
    async run(id, ...args) {
      const command = commands.get(id)
      if (!command) throw new Error(`命令不存在: ${id}`)
      return command.handler(...args)
    },
  })
}

export default { name, apply }
