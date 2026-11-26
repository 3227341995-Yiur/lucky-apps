/**
 * 托盘右键菜单的注册模型：主窗口收集插件注册项，序列化成纯数据交给菜单窗口。
 * 处理函数留在主窗口执行，托盘窗口只负责渲染。
 */

export interface TrayMenuItem {
  id: string
  label?: string
  icon?: string
  iconSvg?: string
  order?: number
  section?: string
  hint?: string
  danger?: boolean
  disabled?: boolean
  hidden?: boolean
  className?: string
  style?: Record<string, string | number>
  /** 打开菜单时求值；返回 false 则不显示 */
  when?: () => boolean
  onSelect?: () => unknown
}

export interface TrayMenuStyle {
  id: string
  css: string
}

export interface TrayMenuRow {
  id: string
  separator?: boolean
  label?: string
  icon?: string
  iconSvg?: string
  hint?: string
  danger?: boolean
  disabled?: boolean
  className?: string
  style?: Record<string, string | number>
}

export interface TrayMenuModel {
  title: string
  items: TrayMenuRow[]
  styles: TrayMenuStyle[]
}

/** 排序、过滤并把 section 边界换成分隔行；函数字段不会进入模型。 */
export function buildTrayMenu(
  items: TrayMenuItem[],
  styles: TrayMenuStyle[] = [],
  title = 'Lucky Apps',
): TrayMenuModel {
  const visible = items
    .filter((item) => {
      if (!item || item.hidden) return false
      try {
        return !item.when || item.when()
      } catch {
        // 单个插件的显隐条件出错不能拖垮整个托盘菜单。
        return false
      }
    })
    .slice()
    .sort((left, right) => (left.order ?? 100) - (right.order ?? 100))

  const rows: TrayMenuRow[] = []
  let section: string | undefined
  for (const item of visible) {
    const current = item.section || 'main'
    if (section !== undefined && current !== section) {
      rows.push({ id: `separator:${section}:${current}`, separator: true })
    }
    section = current
    rows.push({
      id: item.id,
      label: item.label || item.id,
      icon: item.icon,
      iconSvg: item.iconSvg,
      hint: item.hint,
      danger: Boolean(item.danger),
      disabled: Boolean(item.disabled),
      className: item.className,
      style: item.style,
    })
  }
  return {
    title,
    items: rows,
    styles: styles.map(style => ({ id: style.id, css: style.css })),
  }
}
