# 插件与扩展开发指南（API v2）

周报管理系统对外暴露 `window.weekReport`，插件脚本、外部组件、命令扩展都通过它访问系统能力。

- API 版本：`2`
- 入口：`window.weekReport`
- 装配顺序：`main.js` → 安装内置能力 → 加载 `resources/css` → 加载 `resources/js` 插件脚本 → 运行时编译并注册外部组件 → 挂载 Vue 应用。插件脚本执行时 API 已就绪。

> 外部 Vue 组件**运行时热加载**：项目使用 Vue 官方团队 `@vue/repl` 的 `compileFile`
> （内部为官方 `vue/compiler-sfc` 浏览器构建）编译 `src-tauri/resources/comps` 下的 SFC。
> 保存文件后自动重新编译并注册，无需重新构建或重启；也可在设置 → 扩展手动热加载。
> 项目不包含自研模板编译器或解析器。

---

## 1. 周报 `weekReport.reports`

| 方法 | 说明 |
| --- | --- |
| `list({ limit, offset })` | 轻量分页列表（不含 `sections`），默认 10 条 |
| `get(id)` | 单条完整周报（含 `sections`），回收站中的返回 `null` |
| `create({ title, dateRange, sections, layout? })` | 新建，返回周报对象，触发 `report:created` |
| `update(report)` | 保存完整周报，触发 `report:updated` |
| `remove(id)` | 移入回收站（软删除），触发 `report:deleted` |
| `restore(id)` | 从回收站恢复，触发 `report:restored` |
| `purge(id)` | 从回收站彻底删除，触发 `report:purged` |
| `emptyTrash()` | 清空回收站，返回删除数量 |
| `trashed({ limit, offset })` | 回收站列表 |
| `search()` | 全量启用中的周报（含 sections），带内存缓存，写操作后自动失效 |
| `stats()` | `{ reports, workItems, trash, templates }` |

周报结构：

```js
{
  id: 1762312345678001,          // 数字主键
  title: '工作周报 - 2026-11-02 ~ 2026-11-08',
  dateRange: ['2026-11-02', '2026-11-08'],
  sections: [
    {
      type: 'completed',
      title: '本周完成',
      icon: 'fas fa-check-circle',
      hasExpandColumn: false,
      columns: [{ prop: 'title', label: '标题' }],
      items: [{ id: 1762312345678002, title: '任务 A' }]
    }
  ],
  created_at: 1762312345678,
  updated_at: 1762312345678
}
```

注意：`remove` 是软删除；编辑中的自动保存不会写入回收站中的周报。

---

## 2. 事件 `weekReport.events`

```js
const off = weekReport.events.on('report:changed', payload => {
  // payload.type: created | updated | deleted | restored | purged | trash-emptied
  console.log(payload)
})
off()
```

| 事件 | payload |
| --- | --- |
| `report:created` | 周报对象 |
| `report:updated` | 周报对象 |
| `report:deleted` | `{ id }` |
| `report:restored` | `{ id }` |
| `report:purged` | `{ id }` |
| `report:trash-emptied` | `{ count }` |
| `report:changed` | `{ type, report? , id? , count? }` |
| `theme:changed` | `{ mode: 'system' \| 'light' \| 'dark', resolved }` |

---

## 3. 模板与默认结构

```js
// 导出模板（Handlebars）
await weekReport.templates.list()
await weekReport.templates.get(id)
await weekReport.templates.save({ id, name, type: 'html' | 'markdown', template })
await weekReport.templates.remove(id)
await weekReport.templates.setDefault(id, type)

// 默认周报结构（自由画布配置）
const config = await weekReport.config.get()
// {
//   version: 2,
//   page: { width, height, background, padding },
//   elements: [{ id, type, x, y, w, h, style, sectionType?, component?, props?, text? }],
//   sections: [{ type, title, icon, columns, hasExpandColumn }]
// }
await weekReport.config.set(config)
await weekReport.config.reset()

// 周报对象包含 layout（page + elements），详情见 docs/report-designer.md
const report = await weekReport.reports.get(id)

// 全量备份（周报含回收站 + 模板 + 默认结构）
const backup = await weekReport.data.createBackup()
await weekReport.data.exportBackup() // 直接下载备份文件
```

---

## 4. 组件扩展（官方 SFC）

把组件放入 `src-tauri/resources/comps/`：

- `Name.vue`：列编辑器组件，接收 `v-model`（单元格值）和列的 `attrs`。
- `Name.cslot.vue`：列属性编辑插槽，接收列对象：

```vue
<script setup>
const column = defineModel() // 列对象，可直接修改
</script>

<template>
  <el-form-item label="选项">
    <!-- 编辑 column.attrs.options 等 -->
  </el-form-item>
</template>
```

列组件在低代码设计器/列配置中显示为 `name`（kebab-case）。运行时使用官方
`@vue/compiler-sfc` 编译，支持：

- `<script setup>`、defineProps/defineEmits/defineModel 等官方宏
- TypeScript（仅擦除类型，不做类型检查）
- `<style scoped>` / 普通 CSS（运行时不做 SCSS/Less 预处理）
- 直接导入：`vue`、`element-plus`、`@element-plus/icons-vue`、`@tauri-apps/api/*`、
  `@tauri-apps/plugin-fs`、`@tauri-apps/plugin-sql`、`handlebars`、`moment`、`lodash`、`vditor`
- 通过 `@resources/xxx.js` 导入资源目录下的 JS 模块

保存文件后自动热加载，**无需重新构建或重启**。在设置 → 扩展中可以启停外部组件；
启停状态保存在数据库，重新加载应用后生效。

### 运行时注册组件

JS 插件可以把已有组件对象注册进系统（列配置中可直接选择）：

```js
const { defineComponent, h } = window.Vue

weekReport.components.register('rating', defineComponent({
  props: { modelValue: Number },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    return () => h('div', { class: 'rating' }, String(props.modelValue ?? 0))
  }
}), { description: '评分列' })

weekReport.components.list()
weekReport.components.has('rating')
```

---

## 5. 运行时插件脚本与样式

- 脚本：`src-tauri/resources/js/*.js`，按文件名排序串行加载。
- 样式：`src-tauri/resources/css/*.css`，按文件名排序注入。
- 脚本为普通 `<script>`（非模块），可直接使用：
  - `window.weekReport`
  - `window.Vue`
  - `window.ElementPlus` / `window.ElementPlusIconsVue`
  - `window.TauriApi` / `window.TauriFs` / `window.TauriPath`
  - `window.Handlebars`

依赖顺序示例：`marked.min.js` 字母序在 `registerHelper.js` 之前，因此 `registerHelper.js` 可以使用 `window.marked`。有强顺序需求时使用数字前缀（`01-xxx.js`）。

---

## 6. 界面与主题

```js
weekReport.ui.selectReport(id)
weekReport.ui.toast('已保存', 'success')
weekReport.ui.openSettings()
weekReport.ui.openImportExport()
weekReport.ui.openDesigner()
weekReport.ui.openTemplates()

weekReport.theme.get()          // { mode, resolved }
weekReport.theme.set('dark')    // system | light | dark
weekReport.theme.cycle()
const off = weekReport.theme.onChange(({ resolved }) => {})
```

插件样式应使用 Element Plus 主题变量（例如 `var(--el-bg-color)`、`var(--el-text-color-primary)`），并同时适配 `html.dark`。

---

## 7. 命令

```js
const dispose = weekReport.commands.register('my-plugin.refresh', async payload => {
  // ...
}, { title: '刷新我的数据' })

await weekReport.commands.run('my-plugin.refresh', { force: true })
weekReport.commands.list()
dispose()
```

外部脚本之间、外部脚本与系统界面之间可以通过命令解耦。

---

## 8. 扩展资源状态

```js
weekReport.extensions.list()
// [{ id, kind: 'style' | 'script' | 'component', name, file, enabled, status, error }]
weekReport.extensions.errors
```

状态值：`pending` / `loaded` / `disabled` / `error`。

---

## 9. 数据与备份

- 数据存储：SQLite（`sqlite:week_report.db`），周报表带 `deleted_at` 软删除字段。
- 设置 → 数据 → 导入/备份：支持单份/批量导出（HTML、Markdown、JSON）与全量备份 JSON。
- 备份包含周报（含回收站）、导出模板、默认结构。

## 10. 安全说明

运行时插件脚本拥有页面全部权限，且可以访问本地数据库。只加载可信来源的资源；安装第三方插件前先审查 `resources/js` 与 `resources/comps`。
