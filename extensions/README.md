# 外部组件插件包

每个目录都是独立 workspace 包，自己用 Vite 构建成单文件 IIFE，按 node_modules 结构输出到
`profile/node_modules/<name>/`（含 `package.json`、`cordis.patch.yml`
、`lib/node.js` 和浏览器 `lib/client.js`），由 profile 组合后交给 Cordis 挂载。宿主不参与插件打包。

```text
extensions/
├─ kpi-card/
│  ├─ package.json       # main/exports -> src/index.js
│  ├─ vite.config.js
│  └─ src/
│     ├─ index.js        # 默认导出 Cordis 插件
│     └─ KpiCard.vue
└─ ...
```

## 构建

```bash
pnpm extensions:build
```

共用 `extensions/build-preset.js`。产物是 IIFE，`vue` / `element-plus` / 图标从宿主 `window` 取，共用同一份实例。

## profile

每个包声明 `weekReport.bundle.patch`，构建时生成自己的 `cordis.patch.yml`：

```yaml
- insert:
    - id: kpi-card
      name: kpi-card
```

内置 profile 在 `profile`，`package.json` 的
`weekReport.profile.bundles` 列出各 bundle；组合顺序为空根 → bundle patches →
profile 的 `cordis.patch.yml`。

外部包安装到 `%APPDATA%/com.lu.week-report/profile/node_modules/<包名>`，并在
`%APPDATA%/com.lu.week-report/profile/package.json` 的 `weekReport.profile.bundles` 里加上包名即可。

## 入口

`src/index.js` 默认导出 Cordis 插件：

```js
import { definePlugin, components } from '@week-report/plugin-api'

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

- 画布组件：`components.registerCanvas`
- 表格列组件：`components.registerColumn`
- 列属性插槽：`components.registerColumnSlot`

组件内部可以直接 import Vue、Element Plus、npm 包、`.vue`、less/scss，由包自己的 Vite 编译。
