<script setup lang="ts">
/**
 * 托盘右键菜单的渲染窗口。菜单项由主窗口的 ctx.tray 注册后以纯数据传来，
 * 这里只负责渲染；插件注入的样式表原样挂到 <head>。
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import type { TrayMenuModel, TrayMenuRow } from '@/cordis/trayModel'

defineOptions({ name: 'TrayMenu' })

// 主窗口还没把模型推过来时也要有可用菜单，默认项直接调 Rust 命令。
const FALLBACK_ROWS: TrayMenuRow[] = [
  { id: 'app:show', label: '显示主界面', icon: 'Monitor' },
  { id: 'app:settings', label: '设置与扩展', icon: 'Setting' },
  { id: 'fallback:separator', separator: true },
  { id: 'app:quit', label: '退出', icon: 'SwitchButton', danger: true },
]

const root = ref<HTMLElement | null>(null)
const title = ref('Lucky Apps')
const rows = ref<TrayMenuRow[]>(FALLBACK_ROWS)
const openId = ref<string | null>(null)
const submenu = computed(() => {
  const row = rows.value.find(item => item.id === openId.value)
  return row?.children?.length ? row : null
})
const unlisteners: Array<() => void> = []
let lastWidth = 0
let lastHeight = 0
let closeTimer: number | undefined
let mediaQuery: MediaQueryList | null = null

function tauriApi() {
  return (window as any).__TAURI__
}

function invoke(command: string, args?: Record<string, unknown>) {
  return tauriApi()?.core?.invoke?.(command, args)
}

function emitTo(target: string, event: string, payload?: unknown) {
  return tauriApi()?.event?.emitTo?.(target, event, payload)
}

function applyResolvedTheme(resolved: string) {
  const dark = resolved === 'dark'
  document.documentElement.classList.toggle('dark', dark)
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
}

const appliedVars = new Set<string>()

/** 把主窗口当前生效的主题变量复制到托盘窗口，外置主题插件也能生效。 */
function applyThemeVars(vars: unknown) {
  if (!vars || typeof vars !== 'object') return
  const root = document.documentElement
  for (const name of appliedVars) root.style.removeProperty(name)
  appliedVars.clear()
  for (const [name, value] of Object.entries(vars as Record<string, unknown>)) {
    if (!name.startsWith('--') || typeof value !== 'string' || !value.trim()) continue
    root.style.setProperty(name, value.trim())
    appliedVars.add(name)
  }
}

/** 主窗口改主题时不重载托盘窗口，优先用主窗口直接推来的 resolved 值。 */
function syncTheme() {
  try {
    const mode = localStorage.getItem('wr:theme')
    applyResolvedTheme(
      mode === 'dark' || (mode !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches)
        ? 'dark'
        : 'light',
    )
  } catch {}
}

function applyStyles(styles: TrayMenuModel['styles'] = []) {
  document.querySelectorAll('style[data-tray-style]').forEach(node => node.remove())
  for (const style of styles) {
    if (!style?.css) continue
    const node = document.createElement('style')
    node.dataset.trayStyle = style.id
    node.textContent = style.css
    document.head.appendChild(node)
  }
}

function applyModel(model: TrayMenuModel | null) {
  syncTheme()
  title.value = model?.title || 'Lucky Apps'
  applyStyles(model?.styles)
  openId.value = null
  const items = Array.isArray(model?.items) ? model.items : []
  rows.value = items.some(item => !item.separator) ? items : FALLBACK_ROWS
  requestAnimationFrame(() => void resizeToContent())
}

async function resizeToContent() {
  const el = root.value
  if (!el) return
  // 窗口高度永远按一级菜单算；二级面板绝对定位，只能在这段高度里滚动。
  const menu = el.querySelector<HTMLElement>('.tray-menu')
  const width = Math.ceil(el.getBoundingClientRect().width)
  const height = Math.ceil(menu?.scrollHeight || el.scrollHeight)
  if (!width || !height) return
  if (width === lastWidth && Math.abs(height - lastHeight) < 2) return
  lastWidth = width
  lastHeight = height
  await invoke('resize_tray_menu', { width, height })
  await invoke('focus_tray_menu')
}

function cancelClose() {
  if (closeTimer === undefined) return
  clearTimeout(closeTimer)
  closeTimer = undefined
}

function openSubmenu(item: TrayMenuRow) {
  cancelClose()
  if (!item.children?.length || item.disabled || openId.value === item.id) return
  openId.value = item.id
  void nextTick(() => void resizeToContent())
}

function closeSubmenu(restoreFocus = false) {
  cancelClose()
  const id = openId.value
  if (id === null) return
  openId.value = null
  void nextTick(() => {
    void resizeToContent()
    if (!restoreFocus) return
    root.value?.querySelector<HTMLButtonElement>(`[data-tray-item="${id}"]`)?.focus()
  })
}

/** 鼠标从一级行挪到左侧二级面板要跨过一点距离，延迟关闭。 */
function scheduleClose() {
  cancelClose()
  closeTimer = window.setTimeout(() => closeSubmenu(), 160)
}

function onRowEnter(item: TrayMenuRow) {
  if (item.children?.length) openSubmenu(item)
  else scheduleClose()
}

function requestModel() {
  emitTo('main', 'tray:menu-request')
}

async function select(item: TrayMenuRow) {
  if (item.separator || item.disabled) return
  // 一级项只负责展开二级面板，真正执行的是子项的 onSelect。
  if (item.children?.length) {
    openSubmenu(item)
    return
  }
  void invoke('hide_tray_menu')
  // 默认项不依赖主窗口是否就绪。
  if (item.id === 'app:show') {
    await invoke('show_main_window')
    return
  }
  if (item.id === 'app:quit') {
    await invoke('quit_app')
    return
  }
  if (item.id === 'app:settings') {
    await invoke('open_settings')
    return
  }
  await emitTo('main', 'tray:menu-select', { id: item.id })
}

function closeMenu() {
  void invoke('hide_tray_menu')
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault()
    if (openId.value) closeSubmenu(true)
    else closeMenu()
    return
  }
  if (event.key === 'ArrowRight') {
    const active = document.activeElement as HTMLElement | null
    const row = rows.value.find(item => item.id === active?.dataset.trayItem)
    if (!row?.children?.length) return
    event.preventDefault()
    openSubmenu(row)
    void nextTick(() => {
      root.value?.querySelector<HTMLButtonElement>('.tray-flyout .tray-item')?.focus()
    })
    return
  }
  if (event.key === 'ArrowLeft' && openId.value) {
    event.preventDefault()
    closeSubmenu(true)
    return
  }
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
  // 只在当前面板里循环，展开的二级项不混进一级的上下键顺序。
  const active = document.activeElement as HTMLElement | null
  const scope = active?.closest('.tray-flyout') || root.value?.querySelector('.tray-menu')
  const buttons = [...(scope?.querySelectorAll<HTMLButtonElement>('.tray-item:not(:disabled)') || [])]
  if (!buttons.length) return
  event.preventDefault()
  const index = buttons.indexOf(active as HTMLButtonElement)
  const next = event.key === 'ArrowDown'
    ? (index + 1) % buttons.length
    : (index - 1 + buttons.length) % buttons.length
  buttons[next]?.focus()
}

onMounted(async () => {
  const events = tauriApi()?.event
  if (events?.listen) {
    try {
      unlisteners.push(await events.listen('tray:menu-model', (event: any) => applyModel(event.payload)))
      unlisteners.push(await events.listen('tray:theme', (event: any) => {
        const resolved = event?.payload?.resolved
        if (resolved === 'dark' || resolved === 'light') applyResolvedTheme(resolved)
        applyThemeVars(event?.payload?.vars)
      }))
    } catch {}
  }
  window.addEventListener('keydown', onKeydown)
  window.addEventListener('storage', (event) => {
    if (event.key === 'wr:theme') syncTheme()
  })
  mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  mediaQuery.addEventListener('change', syncTheme)
  window.addEventListener('focus', syncTheme)
  syncTheme()
  requestModel()
  document.fonts?.ready.then(() => void resizeToContent()).catch(() => {})
})

onBeforeUnmount(() => {
  if (closeTimer !== undefined) clearTimeout(closeTimer)
  for (const off of unlisteners.splice(0)) {
    try { off() } catch {}
  }
  mediaQuery?.removeEventListener('change', syncTheme)
  mediaQuery = null
  window.removeEventListener('focus', syncTheme)
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div
    ref="root"
    class="tray-shell"
    :class="{ 'has-submenu': submenu }"
    @mouseenter="cancelClose"
    @mouseleave="scheduleClose"
  >
    <div
      v-if="submenu"
      class="tray-flyout"
      role="menu"
      :aria-label="submenu.label"
      @mouseenter="cancelClose"
    >
      <div class="tray-menu-title">{{ submenu.label }}</div>
      <button
        v-for="child in submenu.children"
        :key="child.id"
        type="button"
        role="menuitem"
        class="tray-item"
        :class="[child.className, { danger: child.danger }]"
        :style="child.style"
        :disabled="child.disabled"
        :data-tray-item="child.id"
        @click="select(child)"
      >
        <span class="tray-icon" aria-hidden="true">
          <span v-if="child.iconSvg" class="tray-icon-svg" v-html="child.iconSvg" />
          <component :is="child.icon" v-else-if="child.icon" />
        </span>
        <span class="tray-label">{{ child.label }}</span>
        <span v-if="child.hint" class="tray-hint">{{ child.hint }}</span>
      </button>
    </div>

    <div class="tray-menu" role="menu" :aria-label="title">
      <div class="tray-menu-title">{{ title }}</div>
      <template v-for="item in rows" :key="item.id">
        <div v-if="item.separator" class="tray-separator" role="separator" />
        <button
          v-else
          type="button"
          role="menuitem"
          class="tray-item"
          :class="[item.className, { danger: item.danger, active: openId === item.id }]"
          :style="item.style"
          :disabled="item.disabled"
          :data-tray-item="item.id"
          @mouseenter="onRowEnter(item)"
          @click="select(item)"
        >
          <span class="tray-icon" aria-hidden="true">
            <span v-if="item.iconSvg" class="tray-icon-svg" v-html="item.iconSvg" />
            <component :is="item.icon" v-else-if="item.icon" />
          </span>
          <span class="tray-label">{{ item.label }}</span>
          <span v-if="item.hint" class="tray-hint">{{ item.hint }}</span>
          <span v-if="item.children?.length" class="tray-arrow" aria-hidden="true">›</span>
        </button>
      </template>
      <div v-if="!rows.length" class="tray-empty">暂无菜单项</div>
    </div>
  </div>
</template>

<style>
/* 托盘窗口没有内边距：背景铺满整个窗口，切换主题也不会露出白边。 */
html,
body,
#tray-menu {
  height: 100%;
  margin: 0;
  background: var(--el-bg-color-overlay) !important;
  overflow: hidden;
}
</style>

<style scoped>
/* 一级菜单在右、二级面板在左；窗口只按一级菜单定高。 */
.tray-shell {
  position: relative;
  display: flex;
  align-items: flex-start;
  width: max-content;
}

.tray-shell.has-submenu {
  padding-left: 232px;
}

.tray-menu {
  position: relative;
  box-sizing: border-box;
  width: 280px;
  max-height: 628px;
  flex: none;
  padding: 6px;
  overflow-y: auto;
  background: var(--el-bg-color-overlay);
  color: var(--el-text-color-regular);
  font-family: var(--el-font-family);
  user-select: none;
}

.tray-flyout {
  position: absolute;
  top: 0;
  left: 0;
  display: flex;
  box-sizing: border-box;
  width: 232px;
  height: 100%;
  flex-direction: column;
  padding: 6px;
  overflow-y: auto;
  border-right: 1px solid var(--el-border-color-lighter);
  background: var(--el-bg-color-overlay);
  color: var(--el-text-color-regular);
  font-family: var(--el-font-family);
  user-select: none;
}

.tray-menu-title {
  padding: 6px 10px 7px;
  overflow: hidden;
  color: var(--el-text-color-secondary);
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-overflow: ellipsis;
  text-transform: uppercase;
  white-space: nowrap;
}

.tray-item {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 9px;
  padding: 7px 10px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: 12.5px;
  text-align: left;
  cursor: default;
}

/* 使用全局主题变量；dropdown 专用变量只在 .el-dropdown 作用域里存在，别直接引用。 */
.tray-item:hover,
.tray-item:focus-visible,
.tray-item.active {
  outline: none;
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}

.tray-item.danger {
  color: var(--el-color-danger);
}

.tray-item.danger:hover,
.tray-item.danger:focus-visible {
  background: var(--el-color-danger-light-9);
  color: var(--el-color-danger);
}

.tray-item:disabled {
  opacity: 0.45;
}

.tray-icon {
  display: grid;
  width: 16px;
  height: 16px;
  flex: none;
  place-items: center;
}

.tray-icon :deep(svg) {
  width: 16px;
  height: 16px;
}

.tray-icon-svg {
  display: grid;
  place-items: center;
}

.tray-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tray-hint {
  margin-left: auto;
  color: var(--el-text-color-placeholder);
  font-size: 10.5px;
}

.tray-arrow {
  flex: none;
  margin-left: auto;
  color: var(--el-text-color-secondary);
  font-size: 14px;
  line-height: 1;
}

.tray-hint + .tray-arrow {
  margin-left: 0;
}

.tray-separator {
  height: 1px;
  margin: 5px 8px;
  background: var(--el-border-color-lighter);
}

.tray-empty {
  padding: 12px 10px;
  color: var(--el-text-color-placeholder);
  font-size: 12px;
  text-align: center;
}
</style>
