# 周报管理系统

基于 **Vue 3.5 + Vite 8 + Element Plus 2.14 + Tauri 2 + SQLite** 的桌面周报工具。

## 功能

- 周报编辑：动态区块 / 动态列、Element Plus 表格、自动保存
- 自由画布设计器：Axure 风格拖拽、真实拖拽预览、标尺、对齐线、8px 吸附、移动/缩放、撤销/重做、图层与对齐
- Element Plus 全量组件面板：可拖入任意 EP 组件并通过 props JSON 配置
- 交互预览：使用真实报表页面点击表格、状态、日期等组件
- 列设置：区块列结构、组件、默认值、attrs 独立对话框
- 回收站：软删除、恢复、彻底删除、清空
- 导入 / 导出：单份、批量、全量备份（HTML / Markdown / JSON）
- 模板设计器：IDE 风格布局，选择周报实时预览（Handlebars）
- 亮色 / 暗色主题，默认跟随系统
- 插件化：外部脚本、样式、Vue 组件、命令、事件、`window.weekReport` API v2
- 设置中心：外观、扩展、模板、数据、关于

## 开发

```sh
pnpm install
pnpm dev          # 浏览器开发（数据库能力需在 Tauri 中运行）
pnpm tauri:dev    # 桌面应用开发
pnpm tauri:build  # 打包
pnpm test         # 纯逻辑自检（Node test runner）
pnpm build        # 前端生产构建
```

环境要求：**Node ≥ 24**，包管理器 **pnpm 12+**（`packageManager` 已固定为 `pnpm@12.16.1`）。

## 目录结构

```
src/
├─ components/
│  ├─ layout/          图标栏 + 周报导航面板
│  ├─ designer/        自由画布设计器、Element Plus 组件渲染
│  ├─ report/          报表页面、区块、列设置
│  ├─ settings/        设置中心与扩展管理
│  ├─ importexport/    导入/导出/备份
│  ├─ trash/           回收站
│  ├─ TemplateDesigner/ 模板设计器（IDE 布局 + 周报预览）
│  ├─ cells/           内置列组件（状态/日期/数字）
│  ├─ editors/         Markdown 编辑器
│  ├─ common/          AppDialog / DateRangeField 等通用件
│  └─ ReportEditor.vue / WelcomePage.vue
├─ composables/        useReports / useTheme / useExtensions
├─ config/             默认周报结构、自由画布布局模型、EP 组件元数据
├─ plugins/            扩展加载、注册中心、对外 API
├─ services/           数据库、模板、配置、导入导出
├─ utils/              日期、防抖、事件、ID、导出渲染
└─ assets/css/         设计令牌与全局样式（亮/暗）
src-tauri/resources/
├─ css/                运行时样式扩展
├─ js/                 运行时插件脚本（search.js / registerHelper.js 等）
└─ comps/              运行时热加载 Vue 组件扩展（官方 @vue/repl compileFile）
```

## 扩展开发

外部 Vue 组件放入 `src-tauri/resources/comps/`，启动时由 Vue 官方团队
`@vue/repl` 的 `compileFile`（内部使用官方 `vue/compiler-sfc` 浏览器构建）运行时编译并注册。
保存文件后会自动热加载，**无需重新构建**；也可以在设置 → 扩展中手动「热加载组件」。
运行时脚本与样式放入 `src-tauri/resources/js|css/`，按文件名排序加载。

完整 API、事件、组件契约见 [docs/plugin-api.md](docs/plugin-api.md)；
画布设计器说明见 [docs/report-designer.md](docs/report-designer.md)。

## 主题

主题模式：`system`（默认）/ `light` / `dark`，保存在 `localStorage` 的 `wr:theme`。
样式统一使用 Element Plus 变量与 `--wr-*` 语义变量；图标栏可快速切换，设置中心可精确选择。
周报页面同样使用系统主题变量，区块表格为 Element Plus `el-table`。

## 数据

- SQLite 数据库 `week_report.db`
- 周报软删除（`deleted_at`），回收站独立视图
- 报表保存自由画布 `layout`；默认画布保存在 `config` 表
- 设置中心 → 数据 → 导入/备份，支持全量备份与恢复
