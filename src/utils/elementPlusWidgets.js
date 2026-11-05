/**
 * 从全局 ElementPlus 模块枚举可拖拽的组件名（el-button / el-table ...）
 */
import { EP_WIDGETS } from '@/config/reportLayout'

export function toKebabComponentName(name) {
  return `el-${String(name)
    .replace(/^El/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()}`
}

export function getAllElComponents() {
  const namespace = typeof window !== 'undefined' ? window.ElementPlus : null
  if (!namespace) return EP_WIDGETS.map(widget => widget.component)

  const names = Object.keys(namespace)
    .filter(name => {
      if (!/^El[A-Z]/.test(name)) return false
      const exported = namespace[name]
      return exported && typeof exported === 'object' &&
        (typeof exported.name === 'string' || exported.render || exported.setup)
    })
    .map(toKebabComponentName)

  return [...new Set([...EP_WIDGETS.map(widget => widget.component), ...names])].sort()
}

export function getElWidget(componentName) {
  const defined = EP_WIDGETS.find(widget => widget.component === componentName)
  if (defined) return { kind: 'el', type: 'el', ...defined }
  return {
    kind: 'el',
    type: 'el',
    component: componentName,
    label: componentName,
    icon: 'fas fa-cube',
    description: 'Element Plus 组件',
    w: 220,
    h: 40,
    props: {},
    text: componentName.replace(/^el-/, '')
  }
}

export function getElComponentLabel(componentName) {
  const defined = EP_WIDGETS.find(widget => widget.component === componentName)
  return defined ? `${defined.label} · ${componentName}` : componentName
}
