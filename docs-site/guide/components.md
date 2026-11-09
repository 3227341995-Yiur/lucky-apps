# 外部组件

外部组件是标准 Vue 项目，放在 `extensions/<name>/`，构建成单文件 IIFE 插件包后由 Cordis 运行时加载。

## 项目结构

```text
extensions/
└─ kpi-card/
   ├─ package.json
   └─ src/
      ├─ index.js
      ├─ KpiCard.vue
      └─ KpiCard.cslot.vue
```

## 入口：Cordis 插件

`src/index.js` 默认导出 Cordis 插件：

```js
import { definePlugin, components } from '@week-report/plugin-api'
import KpiCard from './KpiCard.vue'

export default definePlugin({
  name: 'kpi-card',
  apply() {
    components.registerCanvas('KpiCard', KpiCard, {
      value: 'kpi-card',
      description: 'KPI 指标卡'
    })
  }
})
```

- `inject: ['weekReport']` 注入系统 API。
- 画布组件用 `components.registerCanvas`，表格列组件用 `components.registerColumn`，列属性插槽用 `components.registerColumnSlot`。
- 外部组件包由 Cordis 管理生命周期，热加载时先 dispose 再重新挂载。

## 组件内部直接 import

组件按普通 Vue 项目写，不需要关心运行时模块映射：

```vue
<script setup>
import { ref, computed } from 'vue'
import { ElButton } from 'element-plus'
import { TrendCharts } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
</script>

<template>
  <div class="kpi">
    <el-button>详情</el-button>
  </div>
</template>

<style scoped lang="scss">
.kpi {
  .title {
    color: var(--el-color-primary);
  }
}
</style>
```

npm 依赖、Vue SFC、TypeScript、less / scss 都由 Vite 正常打包。

## 包与 profile

每个插件是独立包，自己执行 `vite build`，产物在包内 `lib/`：
`lib/node.js`（Node half）和 `lib/client.js`（浏览器 bundle），包根目录带
`cordis.patch.yml`。`pnpm profile:build` 会把包 `pnpm pack` 成 tarball，
再由 `pnpm install` 安装到 `profile/node_modules`（真实 pnpm profile，不是手工复制）。

profile 结构：

```text
profile/
├─ package.json        weekReport.profile.bundles + 依赖
├─ cordis.yml          []（空根节点）
├─ cordis.patch.yml    用户 patch 层
├─ vendor/             pnpm pack 生成的包 tarball
├─ pnpm-lock.yaml      pnpm 安装锁
└─ node_modules/       pnpm install 的真实依赖树
   ├─ vue/
   ├─ element-plus/
   ├─ @element-plus/icons-vue/
   ├─ week-report-base/
   └─ kpi-card/ ...
```

组合顺序和 DSH 一致：空根 → 各 bundle 的 `weekReport.bundle.patch` →
profile 的 `cordis.patch.yml`。patch 支持 `insert` 新行和按 `id` 覆盖行，
`config` 整行替换，不做深合并。

组件包的 patch：

```yaml
- insert:
    - id: kpi-card
      name: kpi-card
```

用户 profile 在 `%APPDATA%\com.lu.week-report\plugins`，结构相同；把包放进
`plugins/node_modules` 并加入 `plugins/package.json` 的
`weekReport.profile.bundles` 即可，不需要重新打包应用。

::: tip 内置组件包
仓库自带 `kpi-card`、`progress-board`、`timeline-card` 三个画布包，以及
`rating-cell`、`progress-cell`、`user-cell`、`money-cell` 四个列组件包，可以直接作为模板。
:::

::: tip Vue / Element Plus
组件包构建为 IIFE，`vue`、`element-plus`、`@element-plus/icons-vue` 由宿主 `window` 提供，
和宿主共用同一份实例；其他 npm 依赖由 Vite 打包。
:::
