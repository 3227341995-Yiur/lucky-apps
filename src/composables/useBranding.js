/**
 * 程序品牌：名称与图标。可由设置界面或外部插件通过 weekReport.branding 修改。
 */
import { reactive } from 'vue'
import { emit } from '@/utils/eventBus'

const STORAGE_KEY = 'wr:branding'
const DEFAULT_BRANDING = {
  name: '周报管理系统',
  icon: ''
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
