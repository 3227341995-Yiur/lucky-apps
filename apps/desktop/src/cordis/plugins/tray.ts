/**
 * 托盘菜单服务：主窗口持有插件注册表与处理函数，右键托盘时把菜单模型推给
 * 独立的 tray-menu 窗口渲染。插件可以注册菜单项、动态显隐、注入自定义样式，
 * 处理函数在主窗口里执行，直接使用 ctx 的导航/设置/命令等宿主能力。
 */
import { buildTrayMenu, type TrayMenuItem, type TrayMenuModel } from '@/cordis/trayModel'

export const name = 'tray'
export const inject = ['branding', 'ui', 'theme']

function tauriApi() {
  return (window as any).__TAURI__
}

function invoke(command: string, args?: Record<string, unknown>) {
  return tauriApi()?.core?.invoke?.(command, args)
}

function emitTo(target: string, event: string, payload: unknown) {
  return tauriApi()?.event?.emitTo?.(target, event, payload)
}

export function apply(ctx) {
  const items = new Map<string, TrayMenuItem>()
  const styles = new Map<string, string>()
  const unlisteners: Array<() => void> = []

  function registerItem(item: TrayMenuItem) {
    if (!item?.id) return () => {}
    const entry = { ...item }
    items.set(entry.id, entry)
    return () => {
      if (items.get(entry.id) === entry) items.delete(entry.id)
    }
  }

  function addStyle(id: string, css: string) {
    if (!id || typeof css !== 'string') return () => {}
    styles.set(id, css)
    return () => {
      if (styles.get(id) === css) styles.delete(id)
    }
  }

  function model(): TrayMenuModel {
    const brand = ctx.branding?.get?.() || {}
    return buildTrayMenu(
      [...items.values()],
      [...styles.entries()].map(([id, css]) => ({ id, css })),
      brand.name || 'Lucky Apps',
    )
  }

  /** 主题变化直接推给托盘窗口，不依赖 localStorage 的 storage 事件。 */
  function pushTheme(theme?: { resolved?: string }) {
    const resolved = theme?.resolved || ctx.theme?.get?.().resolved || 'light'
    void emitTo('tray-menu', 'tray:theme', { resolved })
  }

  function refresh() {
    pushTheme()
    void emitTo('tray-menu', 'tray:menu-model', model())
  }

  ctx.provide('tray', {
    registerItem,
    addStyle,
    list: () => [...items.values()],
    listStyles: () => [...styles.entries()].map(([id, css]) => ({ id, css })),
    refresh,
  })

  // 默认入口走同一套注册表，插件可以用 order/section 排到它们之间。
  registerItem({
    id: 'app:show',
    label: '显示主界面',
    icon: 'Monitor',
    order: 10,
    section: 'app',
    onSelect: () => invoke('show_main_window'),
  })
  registerItem({
    id: 'app:settings',
    label: '设置与扩展',
    icon: 'Setting',
    order: 20,
    section: 'app',
    onSelect: () => invoke('open_settings'),
  })
  registerItem({
    id: 'app:quit',
    label: '退出',
    icon: 'SwitchButton',
    order: 900,
    section: 'quit',
    danger: true,
    onSelect: () => invoke('quit_app'),
  })

  // 跟随系统 / 手动切换都会经过 theme:changed；托盘窗口即使隐藏也能收到。
  unlisteners.push(ctx.theme.onChange((theme: { resolved?: string }) => pushTheme(theme)))

  async function listen() {
    const events = tauriApi()?.event
    if (!events?.listen) return
    try {
      unlisteners.push(await events.listen('tray:menu-open', refresh))
      unlisteners.push(await events.listen('tray:menu-request', refresh))
      unlisteners.push(await events.listen('tray:menu-select', async (event: any) => {
        const item = items.get(event?.payload?.id)
        if (!item || item.disabled) return
        try {
          await item.onSelect?.()
        } catch (error: any) {
          console.error('[tray] 菜单项执行失败:', error)
          ctx.ui?.toast?.(`菜单操作失败：${error?.message || error}`, 'error')
        }
      }))
    } catch (error) {
      console.warn('[tray] 事件监听失败:', error)
    }
  }

  void listen()
  ctx.effect(() => () => {
    for (const off of unlisteners.splice(0)) {
      try { off() } catch {}
    }
    items.clear()
    styles.clear()
  })
}

export default { name, apply }
