/**
 * 从全局 ElementPlus 模块枚举可拖拽的组件名（el-button / el-table ...）
 */
import * as ElementPlus from 'element-plus'
import { EP_WIDGETS } from '@/config/reportLayout'

export function toKebabComponentName(name) {
  return `el-${String(name)
    .replace(/^El/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()}`
}

export function getAllElComponents() {
  const namespace = ElementPlus
  if (!namespace) return EP_WIDGETS.map(widget => widget.component)

  const names = Object.keys(namespace)
    .filter((name) => {
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
    text: componentName.replace(/^el-/, ''),
  }
}

export function getElComponentLabel(componentName) {
  const defined = EP_WIDGETS.find(widget => widget.component === componentName)
  return defined ? `${defined.label} · ${componentName}` : componentName
}

const EL_COMPONENT_ICONS = {
  'el-button': 'Pointer',
  'el-input': 'EditPen',
  'el-select': 'ArrowDown',
  'el-date-picker': 'Calendar',
  'el-input-number': 'Odometer',
  'el-switch': 'Switch',
  'el-slider': 'Operation',
  'el-rate': 'Star',
  'el-tag': 'CollectionTag',
  'el-progress': 'DataLine',
  'el-alert': 'Warning',
  'el-card': 'Postcard',
  'el-divider': 'Minus',
  'el-table': 'Grid',
  'el-avatar': 'User',
  'el-badge': 'Bell',
  'el-tabs': 'Files',
  'el-menu': 'Menu',
  'el-breadcrumb': 'Link',
  'el-steps': 'Guide',
  'el-timeline': 'Clock',
  'el-collapse': 'Expand',
  'el-descriptions': 'Document',
  'el-row': 'Grid',
  'el-space': 'Rank',
  'el-form': 'Edit',
  'el-pagination': 'DArrowRight',
  'el-result': 'CircleCheck',
  'el-empty': 'Box',
  'el-statistic': 'TrendCharts',
  'el-skeleton': 'Loading',
}

export function getElComponentIcon(componentName) {
  const name = String(componentName || '')
  if (EL_COMPONENT_ICONS[name]) return EL_COMPONENT_ICONS[name]
  if (name.includes('table')) return 'Grid'
  if (name.includes('date') || name.includes('calendar')) return 'Calendar'
  if (name.includes('select') || name.includes('dropdown')) return 'ArrowDown'
  if (name.includes('input') || name.includes('textarea')) return 'EditPen'
  if (name.includes('button')) return 'Pointer'
  if (name.includes('tag')) return 'CollectionTag'
  if (name.includes('progress')) return 'DataLine'
  if (name.includes('alert')) return 'Warning'
  if (name.includes('card')) return 'Postcard'
  if (name.includes('avatar')) return 'User'
  if (name.includes('badge')) return 'Bell'
  if (name.includes('menu')) return 'Menu'
  if (name.includes('tabs')) return 'Files'
  if (name.includes('timeline')) return 'Clock'
  if (name.includes('collapse')) return 'Expand'
  if (name.includes('pagination')) return 'DArrowRight'
  if (name.includes('form')) return 'Edit'
  if (name.includes('row') || name.includes('col')) return 'Grid'
  if (name.includes('space')) return 'Rank'
  if (name.includes('result')) return 'CircleCheck'
  if (name.includes('empty')) return 'Box'
  if (name.includes('statistic')) return 'TrendCharts'
  if (name.includes('skeleton') || name.includes('loading')) return 'Loading'
  return 'Grid'
}
