# 插件 API 包

外部组件项目不再直接访问 `ctx.weekReport` 或全局变量，统一从 npm 包导入：

```bash
pnpm add @week-report/plugin-api
```

```js
import { definePlugin, components } from '@week-report/plugin-api'
import KpiCard from './KpiCard.vue'

export default definePlugin({
  name: 'kpi-card',
  apply() {
    components.registerCanvas('KpiCard', KpiCard, {
      value: 'kpi-card',
      icon: 'TrendCharts',
      description: 'KPI 指标卡'
    })
  }
})
```

## 导出

| 导出 | 说明 |
| --- | --- |
| `definePlugin(plugin)` | 声明 Cordis 插件对象 |
| `components.registerColumn` | 注册表格列组件 |
| `components.registerCanvas` | 注册画布组件 |
| `components.registerColumnSlot` | 注册列属性编辑插槽 |
| `components.list` / `listColumns` / `listCanvas` / `has` | 查询已注册组件 |
| `navigation.register` | 注册左侧栏入口和自定义页面 |
| `settings.register` | 注册设置中心面板 |
| `branding.get` / `set` / `onChange` | 读取或修改程序名称、图标 |
| `events.on` / `once` / `off` | 订阅宿主事件 |
| `ui.toast` / `selectReport` / `openSettings` / `openImportExport` / `openDesigner` / `openTemplates` | 调用宿主界面 |
| `commands.register` / `run` / `list` | 注册/执行命令 |
| `useWeekReport()` | 返回完整宿主 API |

宿主加载 client bundle 前会设置 `__WEEK_REPORT_HOST__`，API 在 `apply()` 内或之后调用都有效。

## 侧边栏页面与设置面板

```js
import { definePlugin, navigation, settings } from '@week-report/plugin-api'
import TrashPage from './TrashPage.vue'

export default definePlugin({
  name: 'trash-bin',
  apply() {
    navigation.register({
      id: 'trash-bin',
      label: '回收站',
      icon: 'Delete',
      component: TrashPage
    })
  }
})
```

设置面板同理使用 `settings.register({ id, label, icon, component })`。

## 包结构

```text
packages/plugin-api/
├─ package.json
├─ index.d.ts
├─ src/index.js
└─ README.md
```

组件包在 `package.json` 中声明依赖：

```json
{
  "dependencies": {
    "@week-report/plugin-api": "workspace:*"
  }
}
```

发布到公司 npm registry 后，外部项目直接安装即可，不需要复制宿主源码。
