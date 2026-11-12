# 资源脚本

`resources/js/*.js` 是普通经典脚本，不是 ES Module，也不注入宿主 API。

需要访问宿主能力（导航、组件、周报数据、命令等）时，请写成 Cordis client bundle 插件，
用 `apply(ctx)` 访问服务；资源脚本只适合做纯 DOM/样式层面的补充。

## 模块加载器

经典脚本和插件 bundle 都可以通过同一个 CJS require 拿到宿主提供的共享模块：

```js
const Vue = window.__ModuleLoader__.require('vue')
const ElementPlus = window.__ModuleLoader__.require('element-plus')
```

可用模块：`vue` · `element-plus` · `@element-plus/icons-vue` · `handlebars`。

## Cordis 插件

脚本、样式和组件包都由 Cordis 管理生命周期；热加载时先 dispose 再重新挂载。
插件在 `apply(ctx)` 里注册能力，在 `ctx.on('dispose')` 里释放资源。

## 事件

事件是 Cordis ctx 事件：

```js
export default {
  name: 'my-plugin',
  apply(ctx) {
    const off = ctx.on('report:changed', report => {
      console.log(report)
    })
    ctx.on('dispose', () => off())
  },
}
```

`report:*` 事件由内置 `reports` 插件触发。

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

```js
export default {
  name: 'my-plugin',
  inject: ['commands', 'weekReport'],
  apply(ctx) {
    const dispose = ctx.commands.register('my-plugin.refresh', async payload => {
      const stats = await ctx.weekReport.reports.stats()
      console.log(stats, payload)
    }, { title: '刷新我的数据' })

    ctx.on('dispose', () => dispose())
  },
}
```
