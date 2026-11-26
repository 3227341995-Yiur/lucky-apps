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
  // 一级项和二级项都进处理器表；菜单模型只下发一级项（子项挂在 rows.children）。
  const handlers = new Map<string, TrayMenuItem>()
  const styles = new Map<string, string>()
  const unlisteners: Array<() => void> = []

  function walk(item: TrayMenuItem, visit: (entry: TrayMenuItem) => void) {
    visit(item)
    for (const child of item.children || []) walk(child, visit)
  }

  function registerItem(item: TrayMenuItem) {
    if (!item?.id) return () => {}
    const entry = { ...item }
    items.set(entry.id, entry)
    walk(entry, child => handlers.set(child.id, child))
    return () => {
      if (items.get(entry.id) === entry) items.delete(entry.id)
      walk(entry, (child) => {
        if (handlers.get(child.id) === child) handlers.delete(child.id)
      })
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

  /**
   * 托盘窗口是独立 webview，la-theme 之类的外置主题只改了主窗口 html 上的
   * CSS 变量；这里把当前生效的 --wr-* / --el-* 一起推过去，菜单才能跟着换肤。
   */
  function readThemeVars(): Record<string, string> {
    const vars: Record<string, string> = {}
    if (typeof document === 'undefined') return vars
    const root = document.documentElement
    const computed = getComputedStyle(root)
    const names = [
      '--wr-bg', '--wr-sidebar-bg', '--wr-surface', '--wr-surface-2', '--wr-border',
      '--wr-text', '--wr-text-2', '--wr-muted', '--wr-accent', '--wr-accent-soft',
      '--wr-danger',
      '--el-color-primary', '--el-color-primary-light-9', '--el-color-danger', '--el-color-danger-light-9',
      '--el-bg-color', '--el-bg-color-overlay', '--el-text-color-primary', '--el-text-color-regular',
      '--el-text-color-secondary', '--el-text-color-placeholder', '--el-border-color-lighter',
      '--el-fill-color-light', '--el-fill-color', '--el-font-family',
    ]
    // 先收插件写在 html 上的内联变量（la-theme 就是这种），再补宿主计算值。
    for (let index = 0; index < root.style.length; index += 1) {
      const name = root.style.item(index)
      if (name.startsWith('--')) vars[name] = root.style.getPropertyValue(name).trim()
    }
    for (const name of names) {
      if (vars[name]) continue
      const value = computed.getPropertyValue(name).trim()
      if (value) vars[name] = value
    }
    return vars
  }

  /** 主题变化直接推给托盘窗口，不依赖 localStorage 的 storage 事件。 */
  function pushTheme(theme?: { resolved?: string }) {
    const resolved = theme?.resolved || ctx.theme?.get?.().resolved || 'light'
    void emitTo('tray-menu', 'tray:theme', { resolved, vars: readThemeVars() })
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
        const item = handlers.get(event?.payload?.id)
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
    handlers.clear()
    styles.clear()
  })
}

export default { name, inject, apply }
