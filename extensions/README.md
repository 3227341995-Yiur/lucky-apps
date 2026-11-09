# 外部组件插件包

每个目录都是独立包，目录结构和入口文件名由包自己决定。宿主只认 `package.json`：

- `weekReport.client.entry`：浏览器组件 bundle
- `main` / `exports`：可选的 Cordis Node 插件入口

这里的示例用 Vite 构建到包内 `lib/`，但不是宿主限制。`pnpm profile:build` 只负责把包安装到 `server/profile/node_modules`。

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

外部包用 `pnpm --dir <profile> add <包名>` 安装到用户 profile 的 node_modules，
并在 `server/profile/package.json` 的 `weekReport.profile.bundles` 里加上包名即可。

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
