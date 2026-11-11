# 插件脚本

`resources/js/*.js` 是普通脚本，不是 ES Module。加载时 `window.weekReport` 已就绪，可以直接调用。

```js
// resources/js/my-plugin.js
const api = window.weekReport

api.ui.toast('插件已加载', 'success')

const off = api.events.on('report:created', report => {
  api.ui.toast(`新建报表：${report.title}`)
})

api.commands.register('my-plugin.refresh', async payload => {
  const stats = await api.reports.stats()
  console.log(stats, payload)
}, { title: '刷新我的数据' })
```

## Cordis 生命周期

外部脚本、样式和组件由 Cordis 作为插件挂载；热加载时先 dispose 再重新注册。
插件脚本可以通过 `window.weekReport.cordis` 访问根 Context，注册自己的插件与清理逻辑。

## 可用全局对象

`window.weekReport`，以及宿主模块加载器 `window.__luckyModules.require('vue' | 'element-plus' | '@element-plus/icons-vue' | 'handlebars')`。

## 事件

通过 `events.on` 订阅，返回取消订阅函数。`report:*` 事件由内置 `reports` 插件触发。

| 事件 | 触发时机 |
| --- | --- |
| `report:created` | 新建报表 |
| `report:updated` | 保存报表 |
| `report:deleted` | 移入回收站 |
| `report:restored` | 从回收站恢复 |
| `report:purged` | 彻底删除 |
| `report:changed` | 以上变更的统一事件 |
| `theme:changed` | 主题切换 |

## 命令

外部脚本之间、外部脚本与系统界面之间可以通过命令解耦。

```js
const dispose = weekReport.commands.register('my-plugin.refresh', async payload => {
  // ...
}, { title: '刷新我的数据' })

await weekReport.commands.run('my-plugin.refresh', { force: true })
dispose()
```
