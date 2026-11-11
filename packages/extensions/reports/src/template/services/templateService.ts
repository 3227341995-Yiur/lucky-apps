/**
 * 模板服务（插件版）
 *
 * 宿主 services/templateService 的插件侧实现：模板 CRUD 走宿主插件 API，
 * 默认模板内容复用 template/config 下的内置文件。
 */
import { useWeekReport } from '@lucky-apps/plugin-api'
import defaultHtmlTemplate from '../config/default-html.html?raw'
import defaultMarkdownTemplate from '../config/default-markdown.md?raw'

export const BUILTIN_TEMPLATE_TYPES = [
  { value: 'html', label: 'HTML' },
  { value: 'markdown', label: 'Markdown' },
]

/**
 * 创建默认 HTML 模板配置（纯模板字符串）
 * 周报数据结构: title, dateRange, sections[{title, columns[{label, prop}], items, hasExpandColumn}]
 */
export function createDefaultTemplateData() {
  return defaultHtmlTemplate
}

/**
 * 创建 Markdown 模板配置
 */
export function createMarkdownTemplateData() {
  return defaultMarkdownTemplate
}

export function templateTypeLabel(type, types = BUILTIN_TEMPLATE_TYPES) {
  return types.find(item => item.value === type)?.label || String(type || '').toUpperCase()
}

/**
 * 获取所有模板
 */
export function getAllTemplates() {
  return useWeekReport().templates.list()
}

/**
 * 保存模板（新增或更新）
 */
export function saveTemplate(template) {
  return useWeekReport().templates.save(template)
}

/**
 * 创建新模板
 */
export function createTemplate(name, type = 'html', template = '') {
  return {
    id: 0,
    name,
    type,
    isDefault: false,
    isSystem: false,
    template,
  }
}

/**
 * 删除模板
 */
export function deleteTemplate(id) {
  return useWeekReport().templates.remove(id)
}

/**
 * 设置默认模板（按类型）
 */
export function setDefaultTemplate(id, type = null) {
  return useWeekReport().templates.setDefault(id, type)
}

/** 模板类型不写死：HTML / Markdown + 数据库里用户创建的自定义类型 */
export async function getTemplateTypes() {
  let list = []
  try {
    list = await useWeekReport().templates.list()
  } catch {
    list = []
  }
  const types = new Map(BUILTIN_TEMPLATE_TYPES.map(item => [item.value, item.label]))
  for (const template of list) {
    if (template?.type) types.set(template.type, templateTypeLabel(template.type))
  }
  return [...types.entries()].map(([value, label]) => ({ value, label }))
}
