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
| `ctx.overlay` | `register` · `list` |
| `ctx.theme` | `get` · `set` · `cycle` · `onChange` |
| `ctx.branding` | `get` · `set` |
| `ctx.ui` | `activeView` · `navigate` · `openSettings` · `toast` |
| `ctx.commands` | `register` · `run` · `list` |
| `ctx.extensions` | `list` · `toggle` · `rescan` · `version` · `errors` |
| `ctx.db` | `select(sql, params)` · `execute(sql, params)` |
| `ctx` 事件 | `ctx.on(event, handler)` · `ctx.emit(event, payload)` |

## 周报插件 API

内置 `reports` 插件在自己的 `apply(ctx)` 里 `ctx.provide('weekReport', ...)`。需要周报能力的插件
声明 `inject: ['weekReport']`，组件里用 `inject('cordis').get('weekReport')`（或声明在先的插件用
`ctx.weekReport`）。

| 命名空间 | 方法 |
| --- | --- |
| `weekReport.reports` | `list` · `get` · `create` · `update` · `remove` · `restore` · `purge` · `emptyTrash` · `trashed` · `search` · `stats` |
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
