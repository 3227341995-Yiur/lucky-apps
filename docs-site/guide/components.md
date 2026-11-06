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
import KpiCard from './KpiCard.vue'

export default {
  name: 'kpi-card',
  inject: ['weekReport'],
  apply(ctx) {
    ctx.weekReport.components.registerCanvas('KpiCard', KpiCard, {
      value: 'kpi-card',
      description: 'KPI 指标卡'
    })
  }
}
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

每个插件是独立包，自己执行 `vite build`，产物按 node_modules 结构输出到
`src-tauri/resources/node_modules/<name>/`（含 `package.json` 和 `lib/index.js`）。
宿主只负责运行时加载，不参与插件打包。

内置包由 `src-tauri/resources/cordis.yml` 声明，条目只写包名：

```yaml
- id: kpi-card
  name: 'kpi-card'
```

外部包安装到用户插件目录（设置 → 扩展 → 复制插件目录），profile 同样只写包名：

```text
<AppData>/plugins/
├─ cordis.yml
└─ node_modules/@acme/my-widget/
   ├─ package.json   # exports / module / main 指向构建产物
   └─ lib/index.js
```

```yaml
- id: my-widget
  name: '@acme/my-widget'
```

宿主从对应的 `node_modules` 读取 `package.json` 的 `exports["."]` / `module` / `main`
解析入口，和 Node 的包解析一致。保存后文件监听会热加载。

::: tip 内置组件包
仓库自带 `kpi-card`、`progress-board`、`timeline-card` 三个画布包，以及
`rating-cell`、`progress-cell`、`user-cell`、`money-cell` 四个列组件包，可以直接作为模板。
:::

::: tip Vue / Element Plus
组件包构建为 IIFE，`vue`、`element-plus`、`@element-plus/icons-vue` 由宿主 `window` 提供，
和宿主共用同一份实例；其他 npm 依赖由 Vite 打包。
:::
