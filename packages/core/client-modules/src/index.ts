/**
 * 宿主插件：收集各 bundle 注册的浏览器 client bundle。
 * 对应 DSH 的 client-modules node half：只登记模块，不执行浏览器代码。
 */
export const name = 'client-modules'

export function apply(ctx) {
  const modules = new Map()

  ctx.provide('clientModules', {
    register(entry) {
      if (!entry?.id || !entry?.file) return
      modules.set(entry.id, {
        id: entry.id,
        package: entry.package || entry.id,
        file: entry.file,
        url: entry.url || `/client/${entry.id}/index.js`,
        status: 'loaded',
      })
    },
    list() {
      return [...modules.values()]
    },
    get(id) {
      return modules.get(id)
    },
    remove(id) {
      modules.delete(id)
    },
  })
}

export default { name, apply }
