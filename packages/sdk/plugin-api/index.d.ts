export interface ComponentMeta {
  value?: string
  description?: string
  icon?: string
  iconSvg?: string
  scope?: 'column' | 'canvas'
}

export interface CordisPlugin {
  name: string
  apply(ctx?: any, config?: unknown): void | Promise<void>
  inject?: string[]
}

export function useWeekReport(): any
export function definePlugin<T extends CordisPlugin>(plugin: T): T

export const components: {
  register(name: string, component: unknown, meta?: ComponentMeta): void
  registerColumn(name: string, component: unknown, meta?: ComponentMeta): void
  registerCanvas(name: string, component: unknown, meta?: ComponentMeta): void
  registerColumnSlot(name: string, component: unknown, meta?: ComponentMeta): void
  list(): unknown[]
  listColumns(): unknown[]
  listCanvas(): unknown[]
  has(name: string): boolean
}

export const branding: {
  get(): { name: string; icon: string }
  set(patch: { name?: string; icon?: string }): { name: string; icon: string }
  onChange(handler: (value: { name: string; icon: string }) => void): () => void
}

export const navigation: {
  register(item: {
    id: string
    label: string
    component: unknown
    icon?: string
    iconSvg?: string
    /** 自定义图标组件，可自行渲染徽标等动态内容 */
    iconComponent?: unknown
    order?: number
  }): unknown
  list(): unknown[]
}

export const settings: {
  register(item: { id: string; label: string; component: unknown; icon?: string; order?: number }): unknown
  list(): unknown[]
}

export const events: {
  on(name: string, handler: (...args: any[]) => void): () => void
  once(name: string, handler: (...args: any[]) => void): () => void
  off(name: string, handler: (...args: any[]) => void): void
}

export const ui: {
  toast(message: string, type?: string): void
  selectReport(id: number | string): Promise<boolean>
  openSettings(): Promise<boolean>
  openImportExport(): Promise<boolean>
  openDesigner(): Promise<boolean>
  openTemplates(): Promise<boolean>
}

export const commands: {
  register(id: string, handler: (...args: any[]) => any, meta?: Record<string, unknown>): () => void
  run(id: string, ...args: any[]): Promise<any>
  list(): unknown[]
}
