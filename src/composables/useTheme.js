/**
 * 主题：亮色 / 暗色 / 跟随系统（默认）
 *
 * - 通过 html.dark 切换 Element Plus 官方暗色变量
 * - 自定义样式统一使用 index.css 中的 --wr-* 变量
 * - 系统主题变化时自动跟随
 */
import { computed, ref } from 'vue'
import { emit } from '@/utils/eventBus'

export const THEME_STORAGE_KEY = 'wr:theme'
export const THEME_MODES = ['system', 'light', 'dark']

export const THEME_LABELS = {
  system: '跟随系统',
  light: '亮色',
  dark: '暗色'
}

function readStoredMode() {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    return THEME_MODES.includes(stored) ? stored : 'system'
  } catch {
    return 'system'
  }
}

const themeMode = ref(readStoredMode())
const systemPrefersDark = ref(false)
let mediaQuery = null
let initialized = false

export const resolvedTheme = computed(() => {
  if (themeMode.value === 'system') return systemPrefersDark.value ? 'dark' : 'light'
  return themeMode.value
})

function applyTheme() {
  if (typeof document === 'undefined') return
  const resolved = resolvedTheme.value
  const root = document.documentElement
  root.classList.toggle('dark', resolved === 'dark')
  root.dataset.theme = resolved
  root.style.colorScheme = resolved

  // 同步 Tauri 原生窗口主题（标题栏等）。
  // 跟随系统时必须传 null，不能把 WebView 的主题写死成当前解析结果，
  // 否则下次启动 prefers-color-scheme 会被窗口主题反向影响，系统亮色也会变 dark。
  import('@tauri-apps/api/window')
    .then(({ getCurrentWindow }) => (
      getCurrentWindow().setTheme(themeMode.value === 'system' ? null : resolved)
    ))
    .catch(() => {})

  if (themeMode.value === 'system') scheduleSystemSync()

  emit('theme:changed', { mode: themeMode.value, resolved })
}

function scheduleSystemSync() {
  if (typeof window === 'undefined') return
  window.setTimeout(() => {
    if (!mediaQuery) return
    if (mediaQuery.matches !== systemPrefersDark.value) {
      systemPrefersDark.value = mediaQuery.matches
      applyTheme()
    }
  }, 120)
}

function syncSystemPreference(event) {
  systemPrefersDark.value = event.matches
  if (themeMode.value === 'system') applyTheme()
}

export function initTheme() {
  if (initialized || typeof window === 'undefined') return
  initialized = true

  mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  systemPrefersDark.value = mediaQuery.matches
  mediaQuery.addEventListener('change', syncSystemPreference)
  applyTheme()
}

export function setTheme(mode) {
  if (!THEME_MODES.includes(mode)) return
  themeMode.value = mode
  try {
    localStorage.setItem(THEME_STORAGE_KEY, mode)
  } catch {
    // localStorage 不可用时仅当前会话生效
  }
  applyTheme()
}

/**
 * 在 跟随系统 -> 亮色 -> 暗色 之间循环（侧栏快捷按钮）
 */
export function cycleTheme() {
  const index = THEME_MODES.indexOf(themeMode.value)
  setTheme(THEME_MODES[(index + 1) % THEME_MODES.length])
}

export function useTheme() {
  return {
    themeMode,
    resolvedTheme,
    modes: THEME_MODES,
    labels: THEME_LABELS,
    setTheme,
    cycleTheme
  }
}

export default useTheme
