# @week-report/plugin-api

周报外部组件项目的官方 API 包。组件项目直接 import，不需要访问 `ctx.weekReport` 或全局变量。

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

- `components.registerColumn` / `registerCanvas` / `registerColumnSlot`
- `events` / `ui` / `commands`
- `useWeekReport()` 返回完整宿主 API

宿主会在加载 client bundle 前设置 `__WEEK_REPORT_HOST__`，所以 API 调用在 `apply()` 或之后都有效。
