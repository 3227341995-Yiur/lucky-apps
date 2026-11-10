# Lucky Apps v3.0.0

基于 **Vue 3.5 + Vite 8 + Element Plus 2.14 + Tauri 2 窗口 + Cordis Node 服务 + SQLite** 的桌面周报工具。

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
- 设置中心：外观、加载动画、扩展、模板、数据、托盘/自启动、关于
- 外部功能扩展：侧边栏入口/页面、设置面板、程序名称/图标、组件安装

## 开发

```sh
pnpm install
pnpm dev          # 浏览器开发（需同时启动 Node 服务）
pnpm tauri:dev    # 桌面应用开发
pnpm tauri:build  # 构建前端/服务并打包
pnpm test         # 纯逻辑自检（Node test runner）
pnpm build:server # 构建 Cordis Node 服务
```

环境要求：**Node ≥ 24**，包管理器 **pnpm 12+**（`packageManager` 已固定为 `pnpm@12.16.1`）。

## 目录结构

```
apps/
├─ desktop/           桌面端（Vue 3 前端，Vite 构建）
├─ server/            Cordis Node 服务（TypeScript，esbuild 打包）
packages/
├─ core/              base / client-modules（tsdown 编译）
├─ sdk/               plugin-api（外部组件 API）
├─ tooling/           cli
└─ extensions/        内置插件包（home / reports / data-io / template-designer /
                      structure-designer / trash-bin / 画布与列组件）
src-tauri/            Tauri 壳（窗口、托盘、exe 品牌）
docs-site/            开发文档（VitePress）
scripts/              server / profile 构建脚本
resources/            运行时样式 / 插件脚本（服务端按清单下发）
```

<details>
<summary>apps/desktop/src 内部结构</summary>

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
├─ packages/extensions/            扩展加载、注册中心、对外 API
├─ cordis/             Cordis 根 Context 与启动插件
├─ services/           数据库、模板、配置、导入导出
├─ utils/              日期、防抖、事件、ID、导出渲染
└─ assets/css/         设计令牌与全局样式（亮/暗）
```

</details>

构建时还会生成 `src-tauri/target/profile/`（Cordis profile：`package.json`
`weekReport.profile.bundles` + `node_modules`，不入库）。

## 扩展开发

外部组件是标准 **Vue 3 + TypeScript** 项目，放在 `packages/extensions/<name>/`，各自构建到包内
`lib/client.js` 和 `lib/node.js`，包自带 `cordis.patch.yml`。`pnpm profile:build` 会用
`pnpm pack` 打包成 profile 依赖，再由 `pnpm install` 生成
`src-tauri/target/profile/node_modules`。绘制 profile 时按 DSH 语义组合：
空根 → 各 bundle 的 `weekReport.bundle.patch` → profile 的 `cordis.patch.yml`。
画布 / 列 / 功能包同样是 bundle，profile 的 `weekReport.profile.bundles` 列出它们。
Node 服务用真实 Cordis loader 按行里的包名从 profile 的 `node_modules` 解析并挂载；
Tauri 窗口只打开服务地址。浏览器依赖 `vue` / `element-plus` / 图标已经由宿主 Vite
构建进 `dist`，不再重复安装到 profile；profile 只包含 Cordis 插件包（约 150KB），
避免安装/卸载时复制上万个无用文件。
首次启动会复制到 `%APPDATA%/com.lu.lucky-apps/profile`，用户可直接改 profile。
应用升级时按 `weekReport.profile.version` 覆盖随包核心包和系统依赖，同时保留用户
自己安装的插件与 bundle；安装器会先结束旧的托盘进程，避免文件占用和多实例。
浏览器侧 client bundle 构建为 IIFE，Vue / Element Plus / 图标使用宿主 `window` 上的同一份实例。
运行时脚本与样式放入 `resources/js|css/`，由服务端 `/api/boot` 清单下发。

完整开发文档（架构、API、组件、列、模板/画布设计器、常见问题）在 [docs-site](docs-site) 与设置中心 → 帮助文档中。

## 主题

主题模式：`system`（默认）/ `light` / `dark`，保存在 `localStorage` 的 `wr:theme`。
样式统一使用 Element Plus 变量与 `--wr-*` 语义变量；图标栏可快速切换，设置中心可精确选择。
周报页面同样使用系统主题变量，区块表格为 Element Plus `el-table`。

## 数据

- SQLite 数据库 `lucky_apps.db`：由周报插件（`packages/extensions/reports` 的 Node half `reports-database`）自己提供，
  宿主壳不持有周报数据层；卸载周报插件即不再挂载数据库
- 周报软删除（`deleted_at`），回收站独立视图
- 报表保存自由画布 `layout`；默认画布保存在 `config` 表
- 左侧导航 → 导入导出（内置插件页），支持全量备份与恢复
