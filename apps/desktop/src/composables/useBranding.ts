/**
 * 程序品牌：名称与图标。可由设置界面或插件通过 ctx.branding 修改。
 */
import { reactive } from 'vue'
import { emit } from '@/utils/eventBus'

const STORAGE_KEY = 'wr:branding'
const DEFAULT_BRANDING = {
  name: 'Lucky Apps',
  icon: '',
}

function readBranding() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    return { ...DEFAULT_BRANDING, ...stored }
  } catch {
    return { ...DEFAULT_BRANDING }
  }
}

export const branding = reactive(readBranding())

function rgbaToDataUrl(icon) {
  if (!icon?.rgba?.length || !icon.width || !icon.height) return ''
  try {
    const canvas = document.createElement('canvas')
    canvas.width = icon.width
    canvas.height = icon.height
    const context = canvas.getContext('2d')
    if (!context) return ''
    context.putImageData(new ImageData(new Uint8ClampedArray(icon.rgba), icon.width, icon.height), 0, 0)
    return canvas.toDataURL('image/png')
  } catch {
    return ''
  }
}

/** 品牌以后端 branding.json 为准恢复，重启/本地存储未落盘时不会退回默认名称。 */
async function restoreBackendBranding() {
  const invoke = window.__TAURI__?.core?.invoke
  if (!invoke) return
  try {
    const state = await invoke('get_branding')
    if (state?.name) branding.name = state.name
    const icon = rgbaToDataUrl(state?.icon)
    if (icon) branding.icon = icon
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ name: branding.name, icon: branding.icon }))
  } catch {}
}

restoreBackendBranding()

export function setBranding(patch = {}) {
  if (typeof patch.name === 'string' && patch.name.trim()) branding.name = patch.name.trim()
  if (typeof patch.icon === 'string') branding.icon = patch.icon
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ name: branding.name, icon: branding.icon }))
  } catch {
    // ignore
  }
  emit('branding:changed', { ...branding })
  return { ...branding }
}

export function useBranding() {
  return { branding, setBranding }
}

export default useBranding
