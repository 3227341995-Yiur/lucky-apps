<script setup lang="ts">
/**
 * 托盘右键菜单的渲染窗口。菜单项由主窗口的 ctx.tray 注册后以纯数据传来，
 * 这里只负责渲染；插件注入的样式表原样挂到 <head>。
 */
import { onBeforeUnmount, onMounted, ref } from 'vue'
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
const unlisteners: Array<() => void> = []
let lastHeight = 0

function tauriApi() {
  return (window as any).__TAURI__
}

function invoke(command: string, args?: Record<string, unknown>) {
  return tauriApi()?.core?.invoke?.(command, args)
}

function emitTo(target: string, event: string, payload?: unknown) {
  return tauriApi()?.event?.emitTo?.(target, event, payload)
}

/** 主窗口改主题时不重载托盘窗口，直接按 localStorage 重新定亮暗。 */
function syncTheme() {
  try {
    const mode = localStorage.getItem('wr:theme')
    const dark = mode === 'dark' || (mode !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches)
    document.documentElement.classList.toggle('dark', dark)
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
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
  const items = Array.isArray(model?.items) ? model.items : []
  rows.value = items.some(item => !item.separator) ? items : FALLBACK_ROWS
  requestAnimationFrame(() => void resizeToContent())
}

async function resizeToContent() {
  const el = root.value
  if (!el) return
  // scrollHeight 是内容真实高度，不受窗口高度和 max-height 限制。
  const height = Math.ceil(el.scrollHeight)
  if (!height || Math.abs(height - lastHeight) < 2) return
  lastHeight = height
  await invoke('resize_tray_menu', { height })
  await invoke('focus_tray_menu')
}

function requestModel() {
  emitTo('main', 'tray:menu-request')
}

async function select(item: TrayMenuRow) {
  if (item.separator || item.disabled) return
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
    closeMenu()
    return
  }
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
  const buttons = [...(root.value?.querySelectorAll<HTMLButtonElement>('.tray-item:not(:disabled)') || [])]
  if (!buttons.length) return
  event.preventDefault()
  const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
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
    } catch {}
  }
  window.addEventListener('keydown', onKeydown)
  window.addEventListener('storage', (event) => {
    if (event.key === 'wr:theme') syncTheme()
  })
  syncTheme()
  requestModel()
  document.fonts?.ready.then(() => void resizeToContent()).catch(() => {})
})

onBeforeUnmount(() => {
  for (const off of unlisteners.splice(0)) {
    try { off() } catch {}
  }
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div ref="root" class="tray-menu" role="menu" :aria-label="title">
    <div class="tray-menu-title">{{ title }}</div>
    <template v-for="item in rows" :key="item.id">
      <div v-if="item.separator" class="tray-separator" role="separator" />
      <button
        v-else
        type="button"
        role="menuitem"
        class="tray-item"
        :class="[item.className, { danger: item.danger }]"
        :style="item.style"
        :disabled="item.disabled"
        :data-tray-item="item.id"
        @click="select(item)"
      >
        <span class="tray-icon" aria-hidden="true">
          <span v-if="item.iconSvg" class="tray-icon-svg" v-html="item.iconSvg" />
          <component :is="item.icon" v-else-if="item.icon" />
        </span>
        <span class="tray-label">{{ item.label }}</span>
        <span v-if="item.hint" class="tray-hint">{{ item.hint }}</span>
      </button>
    </template>
    <div v-if="!rows.length" class="tray-empty">暂无菜单项</div>
  </div>
</template>

<style>
/* 托盘窗口没有内边距：背景铺满整个窗口，切换主题也不会露出白边。 */
html,
body,
#tray-menu {
  height: 100%;
  margin: 0;
  background: var(--wr-surface) !important;
  overflow: hidden;
}
</style>

<style scoped>
.tray-menu {
  box-sizing: border-box;
  max-height: 628px;
  padding: 6px;
  overflow-y: auto;
  background: var(--wr-surface);
  color: var(--wr-text-2);
  font-family: var(--el-font-family);
  user-select: none;
}

.tray-menu-title {
  padding: 6px 10px 7px;
  overflow: hidden;
  color: var(--wr-muted);
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

.tray-item:hover,
.tray-item:focus-visible {
  outline: none;
  background: var(--wr-accent-soft);
  color: var(--wr-text);
}

html.dark .tray-item:hover,
html.dark .tray-item:focus-visible {
  background: var(--el-fill-color-light);
}

.tray-item.danger {
  color: var(--wr-danger);
}

.tray-item.danger:hover,
.tray-item.danger:focus-visible {
  background: rgba(229, 72, 77, 0.12);
  color: var(--wr-danger);
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
  color: var(--wr-muted);
  font-size: 10.5px;
}

.tray-separator {
  height: 1px;
  margin: 5px 8px;
  background: var(--wr-border);
}

.tray-empty {
  padding: 12px 10px;
  color: var(--wr-muted);
  font-size: 12px;
  text-align: center;
}
</style>
