/**
 * 组件命名工具：外部文件/配置里统一使用 kebab-case，
 * Vue 全局注册使用 PascalCase。
 */
export function capitalize(value) {
  const text = String(value || '')
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export function toPascalCase(value) {
  return String(value || '')
    .split(/[-_\s./]+/)
    .filter(Boolean)
    .map(capitalize)
    .join('')
}

export function toKebabCase(value) {
  return String(value || '')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase()
}

export function stripComponentExtension(fileName) {
  return String(fileName || '')
    .replace(/\.cslot\.vue$/i, '')
    .replace(/\.vue$/i, '')
    .replace(/\.js$/i, '')
}
