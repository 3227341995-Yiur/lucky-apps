/**
 * Cordis 扩展生命周期
 *
 * 外部脚本 / 样式 / 组件都作为 Cordis 插件挂载，热加载时先 dispose 再重新 plugin。
 * 外部组件包由 Vite 预构建，Cordis 负责生命周期与依赖注入。
 */
import { ctx as cordis } from '@/cordis/context'

export { cordis }

const fibers = new Map()

export async function mountCordisPlugin(name, setup) {
  await unmountCordisPlugin(name)

  const plugin = {
    name,
    async apply(ctx) {
      const dispose = await setup(ctx)
      if (typeof dispose === 'function') ctx.on('dispose', dispose)
    }
  }

  const fiber = cordis.plugin(plugin)
  fibers.set(name, fiber)
  await fiber
  return fiber
}

/**
 * 挂载外部组件包导出的 Cordis 插件对象
 */
export async function mountCordisPluginObject(name, plugin, config) {
  await unmountCordisPlugin(name)
  const fiber = config === undefined ? cordis.plugin(plugin) : cordis.plugin(plugin, config)
  fibers.set(name, fiber)
  await fiber
  return fiber
}

export async function unmountCordisPlugin(name) {
  const fiber = fibers.get(name)
  if (!fiber) return
  fibers.delete(name)
  try {
    await fiber.dispose()
  } catch (error) {
    console.warn(`[cordis] dispose ${name} failed:`, error)
  }
}

export async function unmountCordisPlugins(prefix) {
  const names = [...fibers.keys()].filter(name => name.startsWith(prefix))
  await Promise.all(names.map(name => unmountCordisPlugin(name)))
}
