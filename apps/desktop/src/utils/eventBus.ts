/**
 * 极简事件总线：系统内部与外部插件共用
 * 事件示例：report:created / report:updated / report:deleted / report:restored / report:purged / report:changed
 */
const listeners = new Map()

export function on(event, fn) {
  if (typeof fn !== 'function') return () => {}
  if (!listeners.has(event)) listeners.set(event, new Set())
  listeners.get(event).add(fn)
  return () => off(event, fn)
}

export function once(event, fn) {
  const dispose = on(event, (payload) => {
    dispose()
    fn(payload)
  })
  return dispose
}

export function off(event, fn) {
  if (fn) listeners.get(event)?.delete(fn)
  else listeners.delete(event)
}

export function emit(event, payload) {
  // 单个监听器异常不影响其他监听器和数据操作本身
  listeners.get(event)?.forEach((fn) => {
    try {
      fn(payload)
    } catch (error) {
      console.error(`[events] 监听器异常 (${event}):`, error)
    }
  })
}

export function clearEvents() {
  listeners.clear()
}

export const events = { on, once, off, emit }
