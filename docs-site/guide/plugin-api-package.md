# 插件能力（Cordis 服务）

插件不依赖宿主 SDK 包，也不读全局对象。宿主能力全部是 Cordis 服务，插件用标准 Cordis 插件形态声明依赖：

```ts
import KpiCard from './KpiCard.vue'

export default {
  name: 'kpi-card',
  inject: ['components'],
  apply(ctx) {
    ctx.components.registerCanvas('KpiCard', KpiCard, {
      value: 'kpi-card',
      icon: 'TrendCharts',
      description: 'KPI 指标卡',
    })
  },
}
```

## 组件里访问 ctx

宿主 Vue 应用通过 `app.provide('cordis', ctx)` 注入根 Context。插件组件直接：

```vue
<script setup lang="ts">
import { inject } from 'vue'

const ctx = inject('cordis')
const enabled = ctx.extensions.list().filter(item => item.enabled).length
</script>
```

## 服务一览

| 服务 | 用途 |
| --- | --- |
| `ctx.navigation` | 左侧导航入口与页面 |
| `ctx.settings` | 设置中心面板 |
| `ctx.components` | 画布 / 列组件、列属性插槽 |
| `ctx.sidebar` | 侧栏面板与图标栏动作 |
| `ctx.overlay` | 全局浮层 |
| `ctx.theme` / `ctx.branding` | 主题与程序品牌 |
| `ctx.ui` | 打开设置、跳转插件页、提示 |
| `ctx.commands` | 命令注册与执行 |
| `ctx.extensions` | 扩展资源状态与启停 |
| `ctx.db` | 通用 SQL RPC（业务表归插件） |
| `ctx` 事件 | `ctx.on` / `ctx.emit` |
| `ctx.weekReport` | 周报插件提供的业务 API（声明 `inject: ['weekReport']`） |

完整方法见 [Cordis 服务与周报 API](/guide/api)。

## 包结构

插件包只依赖 `cordis` 类型（如需类型提示）和它自己的构建依赖；不再有 `@lucky-apps/plugin-api` 运行时包。

```json
{
  "keywords": ["cordis", "lucky-app"],
  "devDependencies": {
    "cordis": "^4.0.0-rc.12",
    "vue": "^3.5.44",
    "element-plus": "^2.14.7"
  }
}
```

发布到 npm 后，外部项目直接安装即可。设置中心的搜索安装只展示 `keywords` 含
`lucky-app` 的包。
