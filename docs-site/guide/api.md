# API 参考

全部能力都挂在 `window.weekReport` 下，API 版本为 2。

| 命名空间 | 方法 |
| --- | --- |
| `reports` | `list` · `get` · `create` · `update` · `remove` · `restore` · `purge` · `emptyTrash` · `trashed` · `search` · `stats` |
| `events` | `on(event, handler)` |
| `templates` | `list` · `get` · `save` · `remove` · `setDefault` |
| `config` | `get` · `set` · `reset` |
| `data` | `createBackup` · `exportBackup` |
| `ui` | `selectReport` · `toast` · `openSettings` · `openImportExport` · `openDesigner` · `openTemplates` |
| `theme` | `get` · `set` · `cycle` · `onChange` |
| `commands` | `register` · `run` · `list` |
| `components` | `register` · `list` · `has` |
| `extensions` | `list` · `errors` |

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

## 默认结构

```js
const config = await weekReport.config.get()
await weekReport.config.set(config)
await weekReport.config.reset()
```

完整字段与示例见 [API 参考](/guide/api) 与 [画布设计器](/guide/report-designer)。
