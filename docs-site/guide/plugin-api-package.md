# 插件 API 包

外部插件项目不直接访问宿主源码或全局变量，统一从 npm 包 `plugin-api` 导入：

```bash
pnpm add plugin-api
```

```js
import { definePlugin, components } from 'plugin-api'
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
| `components.registerColumn` / `registerCanvas` / `registerColumnSlot` | 注册列组件、画布组件、列属性编辑插槽 |
| `components.register` / `list` / `listColumns` / `listCanvas` / `has` | 通用注册与查询 |
| `navigation.register` / `list` / `open` | 注册/打开左侧栏入口与自定义页面 |
| `sidebar.registerPanel` / `registerRailAction` | 注册侧栏面板与图标栏动作 |
| `overlay.register` / `list` | 注册全局浮层 |
| `settings.register` / `list` | 注册设置中心面板（内置 `reports` 插件用它提供组件维护页） |
| `branding.get` / `set` / `onChange` | 读取或修改程序名称、图标（只影响界面；窗口标题与 exe 图标走设置中心「程序名称与图标」） |
| `events.on` / `once` / `off` | 订阅宿主事件 |
| `ui.toast` / `selectReport` / `openSettings` / `openImportExport` / `openDesigner` / `openTemplates` | 调用宿主界面 |
| `commands.register` / `run` / `list` | 注册/执行命令 |
| `useWeekReport()` | 返回完整宿主 API（兼容旧写法） |

宿主加载 client bundle 前会设置 `__WEEK_REPORT_HOST__`，API 在 `apply()` 内或之后调用都有效。

## 侧边栏页面与设置面板

```js
import { definePlugin, navigation, settings } from 'plugin-api'
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

导航项支持 `icon`（Element Plus 图标名）、`iconSvg`（HTML 字符串）或
`iconComponent`（Vue 组件）。组件图标可以自己处理状态和徽标，例如回收站入口：

```js
import TrashNavIcon from './TrashNavIcon.vue'

navigation.register({
  id: 'trash-bin',
  label: '回收站',
  iconComponent: TrashNavIcon,
  component: TrashPage
})
```

## 包结构

```text
packages/sdk/plugin-api/
├─ package.json
├─ index.d.ts
├─ src/index.ts
└─ README.md
```

插件包在 `package.json` 中声明依赖和搜索标签：

```json
{
  "keywords": ["cordis", "lucky-app"],
  "dependencies": {
    "plugin-api": "workspace:*"
  }
}
```

发布到 npm 后，外部项目直接安装即可，不需要复制宿主源码。设置中心的搜索安装只展示
`keywords` 含 `lucky-app` 的包。
