/**
 * Lucky Apps host service types.
 *
 * This package has no runtime code. Add it as a devDependency and import it
 * type-only to get typed ctx services:
 *
 *   import type {} from '@lucky-apps/plugin-types'
 */
import type { Context as CordisContext } from 'cordis'

export interface NavItem {
  id: string
  label: string
  icon?: string
  iconSvg?: string
  iconComponent?: unknown
  order?: number
  /** Icon only highlights, never opens the page */
  railStatic?: boolean
  component: unknown
}

export interface SettingsSection {
  id: string
  label: string
  icon?: string
  order?: number
  component: unknown
}

export interface ComponentMeta {
  value?: string
  icon?: string
  iconSvg?: string
  description?: string
  [key: string]: unknown
}

export interface SidebarPanel {
  id: string
  order?: number
  component: unknown
}

export interface RailAction {
  id: string
  order?: number
  icon?: string
  title?: string
  onClick: () => void
}

export interface OverlayItem {
  id: string
  order?: number
  component: unknown
}

export interface CommandMeta {
  title?: string
  [key: string]: unknown
}

export interface ExtensionResource {
  id: string
  kind: string
  name: string
  enabled: boolean
  status: string
  [key: string]: unknown
}

export interface ThemeApi {
  modes: string[]
  labels: Record<string, string>
  get(): { mode: string; resolved: string }
  set(mode: string): void
  cycle(): void
  onChange(fn: (theme: { mode: string; resolved: string }) => void): () => void
}

export interface BrandingApi {
  get(): { name: string; icon: string }
  set(patch: { name?: string; icon?: string }): { name: string; icon: string }
}

export interface UiApi {
  activeView: { value: string | null }
  setActiveView(view: string | null): void
  navigate(id: string): boolean
  openSettings(): boolean
  toast(message: string, type?: 'success' | 'warning' | 'info' | 'error'): void
}

export interface ExtensionsApi {
  state: unknown
  version: { value: number }
  list(): ExtensionResource[]
  toggle(id: string): Promise<boolean | null>
  rescan(): Promise<unknown>
  readonly errors: string[]
}

export interface DbApi {
  select(sql: string, params?: unknown[]): Promise<any[]>
  execute(sql: string, params?: unknown[]): Promise<{ rowsAffected: number; lastInsertId: number }>
}

export interface ReportRow {
  id: number
  title: string
  dateRange: string[]
  sections: unknown[]
  layout?: unknown
  created_at: number
  updated_at: number
  [key: string]: unknown
}

export interface WeekReportApi {
  events: {
    on(event: string, listener: (payload: any) => void): () => void
    emit(event: string, ...args: any[]): void
  }
  reports: {
    list(params?: unknown): Promise<ReportRow[]>
    trashed(params?: unknown): Promise<ReportRow[]>
    get(id: number): Promise<ReportRow | null>
    create(data: Partial<ReportRow>): Promise<ReportRow>
    update(report: ReportRow): Promise<ReportRow>
    remove(id: number): Promise<boolean>
    restore(id: number): Promise<boolean>
    purge(id: number): Promise<boolean>
    emptyTrash(): Promise<number>
    search(): Promise<ReportRow[]>
    stats(): Promise<Record<string, number>>
  }
  templates: Record<string, (...args: any[]) => Promise<any>>
  config: Record<string, (...args: any[]) => Promise<any>>
  data: Record<string, (...args: any[]) => Promise<any>>
  ui: {
    selectReport(id: number): Promise<ReportRow | null>
    currentReportId(): number | null
    isReportsVisible(): boolean
    openSettings(): boolean
    openImportExport(): void
    openDesigner(): void
    openTemplates(): void
    toast(message: string, type?: string): void
  }
}

export interface NavigationApi {
  register(item: NavItem): () => void
  list(): NavItem[]
  open(id: string): boolean
}

export interface SettingsApi {
  register(section: SettingsSection): () => void
  list(): SettingsSection[]
}

export interface ComponentsApi {
  register(name: string, component: unknown, meta?: ComponentMeta): () => void
  registerColumn(name: string, component: unknown, meta?: ComponentMeta): () => void
  registerCanvas(name: string, component: unknown, meta?: ComponentMeta): () => void
  registerColumnSlot(name: string, component: unknown, meta?: ComponentMeta): () => void
  list(): unknown[]
  listColumns(): unknown[]
  listCanvas(): unknown[]
  has(name: string): boolean
  hasColumnSlot(name: string): boolean
}

export interface SidebarApi {
  registerPanel(panel: SidebarPanel): () => void
  registerRailAction(action: RailAction): () => void
  list(): SidebarPanel[]
  listRailActions(): RailAction[]
}

export interface OverlayApi {
  register(item: OverlayItem): () => void
  list(): OverlayItem[]
}

export interface CommandsApi {
  register(id: string, handler: (...args: any[]) => any, meta?: CommandMeta): () => void
  run(id: string, ...args: any[]): Promise<any>
  list(): Array<{ id: string } & CommandMeta>
}

declare module 'cordis' {
  interface Context {
    navigation: NavigationApi
    settings: SettingsApi
    components: ComponentsApi
    sidebar: SidebarApi
    overlay: OverlayApi
    theme: ThemeApi
    branding: BrandingApi
    ui: UiApi
    commands: CommandsApi
    extensions: ExtensionsApi
    db: DbApi
    /** Provided by the reports plugin. */
    weekReport: WeekReportApi
  }
}

export type { CordisContext }
