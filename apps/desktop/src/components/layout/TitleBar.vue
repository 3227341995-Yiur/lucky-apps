<script setup lang="ts">
/**
 * 窗口标题栏：只负责拖拽和窗口按钮，页面标题由页面自己展示，避免重复。
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

defineOptions({ name: 'TitleBar' })

const isMac = /mac/i.test(navigator.userAgent)
const side = computed(() => (isMac ? 'left' : 'right'))
// 浏览器里没有窗口可控制，按钮只属于桌面壳。
const isDesktop = typeof window !== 'undefined' && Boolean((window as any).__TAURI_INTERNALS__)
const maximized = ref(false)

function currentWindow() {
  return (window as any).__TAURI__?.window?.getCurrentWindow?.() || null
}

async function minimize() {
  try { await currentWindow()?.minimize() } catch {}
}

async function toggleMaximize() {
  try {
    await currentWindow()?.toggleMaximize()
    maximized.value = Boolean(await currentWindow()?.isMaximized())
  } catch {}
}

async function close() {
  try { await currentWindow()?.close() } catch {}
}

let unlisten: (() => void) | null = null

onMounted(async () => {
  const win = currentWindow()
  if (!win) return
  try {
    maximized.value = Boolean(await win.isMaximized())
    unlisten = await win.onResized(async () => {
      maximized.value = Boolean(await win.isMaximized())
    })
  } catch {}
})

onBeforeUnmount(() => {
  unlisten?.()
  unlisten = null
})
</script>

<template>
  <header class="titlebar" :class="{ 'is-browser': !isDesktop }" :data-side="side">
    <!-- Tauri 2.10 只认事件目标本身，空白拖拽层铺在内容底下。 -->
    <div class="titlebar-drag" data-tauri-drag-region />

    <div class="titlebar-inner">
      <div v-if="isDesktop && side === 'left'" class="window-buttons mac-buttons">
        <button class="mac-dot close" type="button" title="关闭" aria-label="关闭" @click="close" />
        <button class="mac-dot minimize" type="button" title="最小化" aria-label="最小化" @click="minimize" />
        <button class="mac-dot maximize" type="button" :title="maximized ? '还原' : '最大化'" :aria-label="maximized ? '还原' : '最大化'" @click="toggleMaximize" />
      </div>

      <!-- 插件页面顶栏通过 Teleport 渲染到这里；空着时整条都是拖拽区。 -->
      <div id="wr-titlebar-slot" class="titlebar-slot" />

      <div v-if="isDesktop && side === 'right'" class="window-buttons">
        <button class="window-button" type="button" title="最小化" aria-label="最小化" @click="minimize">
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 8h8" /></svg>
        </button>
        <button class="window-button" type="button" :title="maximized ? '还原' : '最大化'" :aria-label="maximized ? '还原' : '最大化'" @click="toggleMaximize">
          <svg v-if="!maximized" viewBox="0 0 16 16" aria-hidden="true"><rect x="4.5" y="4.5" width="7" height="7" rx="1.5" /></svg>
          <svg v-else viewBox="0 0 16 16" aria-hidden="true">
            <rect x="4.5" y="6" width="5.5" height="5.5" rx="1.5" />
            <path d="M6.5 6V4.5A1.5 1.5 0 0 1 8 3h3.5A1.5 1.5 0 0 1 13 4.5V8a1.5 1.5 0 0 1-1.5 1.5H10" />
          </svg>
        </button>
        <button class="window-button close" type="button" title="关闭" aria-label="关闭" @click="close">
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 5l6 6M11 5l-6 6" /></svg>
        </button>
      </div>
    </div>
  </header>
</template>

<style scoped>
.titlebar {
  position: relative;
  flex: none;
  height: var(--wr-titlebar-height, 40px);
  border-bottom: 1px solid var(--wr-border);
  background: var(--wr-titlebar-bg);
  color: var(--wr-titlebar-fg);
  user-select: none;
  -webkit-user-select: none;
}

/* 浏览器里没有窗口按钮；没有页面顶栏时整条标题栏也不占高度。 */
.titlebar.is-browser:not(:has(.titlebar-slot > *)) {
  display: none;
}

.titlebar-drag {
  position: absolute;
  inset: 0;
  z-index: 0;
}

.titlebar-inner {
  position: relative;
  z-index: 1;
  display: flex;
  height: 100%;
  align-items: center;
  pointer-events: none;
}

.titlebar-inner :deep(button) {
  pointer-events: auto;
}

.titlebar-slot {
  display: flex;
  flex: 1;
  min-width: 0;
  height: 100%;
  align-items: center;
  overflow: hidden;
}

.window-buttons {
  display: flex;
  flex: none;
  align-items: center;
  gap: 4px;
  padding: 0 4px;
}

/* 32px 方块放在 40px 标题栏里，上下留 4px，和按钮之间、右侧边距完全一致。 */
.window-button {
  display: grid;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 0;
  border-radius: 9px;
  background: transparent;
  color: var(--wr-titlebar-fg);
  cursor: default;
  place-items: center;
  transition: background-color 0.14s ease, color 0.14s ease, transform 0.08s ease;
}

.window-button svg {
  width: 16px;
  height: 16px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.35;
  stroke-linecap: round;
  stroke-linejoin: round;
}

/* 用 Element Plus 的亮暗变量，暗色下不会出现白色悬浮块。 */
.window-button:hover {
  background: var(--el-fill-color-dark);
  color: var(--el-color-primary);
}

.window-button:active {
  background: var(--el-fill-color);
  color: var(--el-color-primary);
  transform: scale(0.94);
}

.window-button.close:hover {
  background: var(--el-color-danger);
  color: #fff;
}

.window-button.close:active {
  background: var(--el-color-danger-dark-2);
  color: #fff;
}

.mac-buttons {
  gap: 8px;
  padding: 0 4px 0 12px;
}

.mac-dot {
  width: 13px;
  height: 13px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  cursor: default;
}

.mac-dot.close {
  background: #ff5f57;
}

.mac-dot.minimize {
  background: #febc2e;
}

.mac-dot.maximize {
  background: #28c840;
}

.mac-dot:hover {
  filter: brightness(0.9);
}
</style>
