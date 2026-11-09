# 外部组件

外部组件项目由组件自己管理：目录结构、入口文件名、构建工具都不由宿主规定。宿主只读取 `package.json`：

```json
{
  "name": "my-widget",
  "version": "1.0.0",
  "weekReport": {
    "client": { "entry": "./dist/my-widget.js" }
  }
}
```

宿主从 profile 的 `node_modules` 发现包，并加载 `client.entry`。入口叫 `index.js`、`plugin.js`、`dist/widget.js` 都可以。

如果还需要 Node 侧 Cordis 逻辑，再声明 `main` / `exports`；宿主会用真实 Cordis loader 挂载。组件注册入口示例：

```js
// 入口名随意，由 package.json exports/main 指定
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

- 画布组件用 `components.registerCanvas`，表格列组件用 `components.registerColumn`，列属性插槽用 `components.registerColumnSlot`。
- 侧边栏入口/页面用 `navigation.register`，和画布组件、列组件是不同扩展类型。仓库的 `trash-bin` 就是一个独立功能组件包：注册左侧回收站入口和完整页面，样式与内置版一致。
- 设置面板入口用 `settings.register`；程序名称/图标用 `branding.set`。
- 包由 Cordis 或 manifest client 入口管理生命周期，热加载时先 dispose 再重新挂载。

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
再由 `pnpm install` 安装到 `server/profile/node_modules`（真实 pnpm profile，不是手工复制）。

profile 结构：

```text
server/profile/
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

用户 profile 在 `%APPDATA%\com.lu.week-report\profile`，结构相同；把包放进
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
