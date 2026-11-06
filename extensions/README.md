# 外部组件插件包

每个目录都是独立 workspace 包，自己用 Vite 构建成单文件 ESM，按 node_modules 结构输出到
`src-tauri/resources/node_modules/@week-report/<name>/`（含 `package.json` 和 `lib/index.js`），
由宿主运行时 import 并通过 Cordis 挂载。宿主不参与插件打包。

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

共用 `extensions/build-preset.js`。它把 `vue` 保留为裸 import，运行时由宿主的
import map 指向 `public/host-vue.js`，保证使用同一个 Vue 实例；自定义构建不要打包第二份 Vue。

## profile

内置包由 `src-tauri/resources/cordis.yml` 声明，只写包名：

```yaml
- id: kpi-card
  name: '@week-report/kpi-card'
```

外部包安装到 `AppData/plugins/node_modules/<包名>`，在
`AppData/plugins/cordis.yml` 同样只写包名，宿主按 Node 语义读取 package.json 入口：

```yaml
- id: my-widget
  name: '@acme/my-widget'
```

## 入口

`src/index.js` 默认导出 Cordis 插件：

```js
export default {
  name: 'kpi-card',
  inject: ['weekReport'],
  apply(ctx) {
    ctx.weekReport.components.registerCanvas('KpiCard', KpiCard, {
      value: 'kpi-card',
      icon: 'TrendCharts',
      description: 'KPI 指标卡'
    })
  }
}
```

- 画布组件：`components.registerCanvas`
- 表格列组件：`components.registerColumn`
- 列属性插槽：`components.registerColumnSlot`

组件内部可以直接 import Vue、Element Plus、npm 包、`.vue`、less/scss，由包自己的 Vite 编译。
