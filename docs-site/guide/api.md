# Cordis 服务与周报 API

宿主只提供通用 Cordis 服务；业务 API 由对应插件自己提供。没有 `window.weekReport` 之类的全局对象。

## 宿主服务

插件在 `apply(ctx)` 里通过 `inject` 声明依赖，再直接访问 `ctx.<service>`；Vue 组件里用
`inject('cordis')` 拿到同一个 ctx。

| 服务 | 方法 |
| --- | --- |
| `ctx.navigation` | `register` · `list` · `open` |
| `ctx.settings` | `register` · `list` |
| `ctx.components` | `registerColumn` · `registerCanvas` · `registerColumnSlot` · `list` · `listColumns` · `listCanvas` · `has` · `hasColumnSlot` |
| `ctx.sidebar` | `registerPanel` · `registerRailAction` · `list` · `listRailActions` |
| `ctx.tray` | `registerItem` · `addStyle` · `list` · `listStyles` · `refresh` |
| `ctx.overlay` | `register` · `list` |
| `ctx.theme` | `get` · `set` · `cycle` · `onChange` |
| `ctx.branding` | `get` · `set` |
| `ctx.ui` | `activeView` · `navigate` · `openSettings` · `toast` |
| `ctx.commands` | `register` · `run` · `list` |
| `ctx.extensions` | `list` · `toggle` · `rescan` · `version` · `errors` |
| `ctx.db` | `select(sql, params)` · `execute(sql, params)` |
| `ctx` 事件 | `ctx.on(event, handler)` · `ctx.emit(event, payload)` |

页面顶栏可以通过 Vue `<Teleport to="#wr-titlebar-slot">` 渲染到窗口标题栏，避免在页面里重复画标题栏；完整示例和注意事项见 [组件扩展](/guide/components#页面顶栏渲染到窗口标题栏)。

## 托盘右键菜单

托盘图标右键菜单由前端渲染，插件通过 `ctx.tray.registerItem()` 加菜单项。处理函数在主窗口执行，
可以直接使用 `ctx.navigation` / `ctx.ui` / `ctx.commands` 等全部宿主服务；托盘菜单窗口只接收
纯数据，所以插件可以随意改菜单外观而不影响主窗口。

```js
export function apply(ctx) {
  ctx.effect(() => ctx.tray.registerItem({
    id: 'reports:new',
    label: '新建本周周报',
    icon: 'DocumentAdd',
    order: 30,
    section: 'app',
    hint: 'Ctrl+N',
    when: () => Boolean(ctx.get?.('weekReport')),
    onSelect: () => ctx.weekReport.reports.createDefault(),
  }))
  // 注入菜单样式：class / style 也可以直接写在菜单项上
  ctx.effect(() => ctx.tray.addStyle('reports', `
    [data-tray-item="reports:new"] .tray-label { font-weight: 600; }
  `))
}
```

- `order` 数值越小越靠前（默认 100）；相邻 `section` 变化会自动分隔。
- `danger` 红色危险项，`disabled` 禁用，`when()` 打开菜单时动态显隐。
- `icon` 用 Element Plus 图标名，`iconSvg` 可直接放自定义 SVG。
- 注册/卸载走 `ctx.effect(() => ctx.tray.registerItem(...))`；样式会跨热重载保留。

## 周报插件 API

内置 `reports` 插件在自己的 `apply(ctx)` 里 `ctx.provide('weekReport', ...)`。需要周报能力的插件
声明 `inject: ['weekReport']`，组件里用 `inject('cordis').get('weekReport')`（或声明在先的插件用
`ctx.weekReport`）。

| 命名空间 | 方法 |
| --- | --- |
| `weekReport.reports` | `list` · `get` · `create` · `createDefault`（按当前配置新建本周周报）· `update` · `remove` · `restore` · `purge` · `emptyTrash` · `trashed` · `search` · `stats` |
| `weekReport.templates` | `list` · `get` · `getDefault` · `save` · `remove` · `setDefault` |
| `weekReport.config` | `get` · `set` · `reset` · `isCustomized` |
| `weekReport.data` | `createBackup` · `exportBackup` · `importBackup` · `copySettings.get/save` |
| `weekReport.ui` | `selectReport` · `currentReportId` · `isReportsVisible` · `openImportExport` · `openDesigner` · `openTemplates` |
| `weekReport.events` | `on` · `emit` |

卸载 `reports` 插件后 `weekReport` 服务不存在；依赖它的插件应在 `inject` 里显式声明，
不要假设服务永远可用。

## 周报结构

```js
{
  id: 1762312345678001,
  title: '工作周报 - 2026-11-02 ~ 2026-11-08',
  dateRange: ['2026-11-02', '2026-11-08'],
  sections: [
    {
      type: 'completed',
      title: '本周完成',
      icon: 'fas fa-check-circle',
      columns: [{ prop: 'title', label: '标题' }],
      items: [{ id: 1762312345678002, title: '任务 A' }]
    }
  ],
  created_at: 1762312345678,
  updated_at: 1762312345678
}
```

完整字段与示例见 [画布设计器](/guide/report-designer)。
