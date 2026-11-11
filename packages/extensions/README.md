# 内置插件包

宿主的内置能力（首页、报表、回收站、画布与列组件）都以插件包形式放在这里；
每个目录都是标准的 **Vue 3 + TypeScript** bundle 包，目录结构、入口文件名、构建工具由包自己决定。宿主只认 `package.json`：

- `keywords`：必须是 `["cordis", "lucky-app"]`，npm 搜索安装只展示带 `lucky-app` 标签的包
- `la.bundle.patch`：bundle 的 `cordis.patch.yml`
- `la.client.entry`：浏览器组件 bundle
- `la.kind`：`canvas` / `column` / `feature`
- 可选的 `main` / `exports`：Node half

这和 DSH 的 bundle 形态一致：包自带 patch，profile 的 `la.profile.bundles` 按顺序叠加。画布 / 列 / 功能包也走同一套 Cordis loader 行，Node half 负责把 client bundle 登记进 clientModules。

```text
packages/extensions/
├─ kpi-card/
│  ├─ package.json
│  ├─ cordis.patch.yml
│  ├─ tsconfig.json
│  ├─ tsdown.config.ts
│  └─ src/
│     ├─ index.ts
│     ├─ env.d.ts
│     └─ KpiCard.vue   <script setup lang="ts">
└─ ...
```

## 构建

```bash
pnpm plugins:build
```

共用 `packages/extensions/tsdown.client.ts`（tsdown client preset），输出 `lib/client.js` 和 `lib/node.js`。依赖和版本由各包自己的 `package.json` 声明；`vue` / `element-plus` / 图标 / `handlebars` 由宿主 client module 注册表提供，插件 bundle 标为 external，由 loader 注入。

## profile

内置 profile 的 `la.profile.bundles` 按顺序列出：

```text
base → home → reports → kpi-card → ... → trash-bin → 外部功能插件
```

功能插件（kind: feature）的页面和后台能力注册为导航/设置面板；
列组件（column）与画布组件（canvas）由内置 `reports` 插件的「设置 → 周报」统一维护。

组合顺序与 DSH 一致：空根 → 各 bundle 的 `cordis.patch.yml` → profile 的 `cordis.patch.yml`。

## 入口

`src/index.ts` 默认导出 Cordis 插件：

```ts
import { definePlugin, components } from '@lucky-apps/plugin-api'
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

- 画布组件：`components.registerCanvas`
- 表格列组件：`components.registerColumn`
- 列属性插槽：`components.registerColumnSlot`

组件内部可以直接 import Vue、Element Plus、npm 包、`.vue`、less/scss，由包自己的 Vite 编译。
