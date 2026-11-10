/**
 * 默认周报结构配置（低代码设计器的持久化）
 *
 * 新格式：JSON 数组，存于 config 表。
 * 兼容旧格式：早期 localStorage 中保存的是 JS 对象字面量字符串，
 * 迁移时原样入库，这里做一次兼容解析（不用于新数据）。
 */
import { loadConfig, saveConfig, clearConfig } from '@/services/database'
import { cloneConfig } from '@/config/defaultReportConfig'
import { normalizeLayoutConfig, createDefaultLayout } from '@/config/reportLayout'

/**
 * 解析配置文本：优先 JSON，失败时兼容旧 JS 字面量
 * @param {string|null} raw
 * @returns {Array|null}
 */
export function parseConfigText(raw) {
  if (!raw) return null
  if (Array.isArray(raw)) return raw
  try {
    return JSON.parse(raw)
  } catch {
    // ponytail: 仅用于旧版 localStorage 迁移数据的一次性兼容解析，新数据一律 JSON
    try {
      const value = new Function(`"use strict";return (${raw})`)()
      return Array.isArray(value) ? value : null
    } catch (error) {
      console.warn('[config] 旧配置解析失败，回退默认结构:', error)
      return null
    }
  }
}

export async function getReportConfig() {
  const raw = await loadConfig()
  return normalizeLayoutConfig(parseConfigText(raw))
}

export async function saveReportConfig(config) {
  const normalized = normalizeLayoutConfig(config)
  await saveConfig(JSON.stringify(normalized))
  return cloneConfig(normalized)
}

/**
 * 恢复系统默认画布（A4 纵向 + 默认区块表格）
 */
export async function resetReportConfig() {
  await clearConfig()
  return cloneConfig(createDefaultLayout())
}

export async function hasCustomReportConfig() {
  return (await loadConfig()) != null
}

export default {
  getReportConfig,
  saveReportConfig,
  resetReportConfig,
  parseConfigText,
}
