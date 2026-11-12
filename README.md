# Lucky Apps v3.2.17

基于 **Vue 3.5 + Vite 8 + Element Plus 2.14 + Tauri 2 窗口 + Cordis Node 服务 + SQLite** 的插件化桌面应用。

宿主只提供窗口、导航、设置、数据 RPC 与插件运行时；业务能力全部以内置或外部插件的形式接入，安装/卸载插件不需要重新构建客户端。

## 内置插件

- `reports`：报表工作台（列表、结构/画布设计、模板设计、导入导出、数据设置）
- `trash-bin`：回收站（软删除、恢复、彻底删除、清空）
- `home`：首页
- 画布组件：`kpi-card` / `progress-board` / `timeline-card`
- 列组件：`rating-cell` / `progress-cell` / `user-cell` / `money-cell`

插件可以注册导航入口与页面、设置面板、程序名称与图标、画布组件、列组件以及列属性编辑插槽。可安装的插件包在 `package.json` 声明 `keywords: ["cordis", "lucky-app"]`，安装面板只检索带 `lucky-app` 标签的包；`@lucky-apps/client-ui`、`@lucky-apps/plugin-types` 等宿主 SDK 包不是插件，不声明这两个标签。

## 开发

```sh
pnpm install
pnpm dev          # 构建文档 + Vite 前端开发（需同时启动 Node 服务）
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
├─ bundle/            profile bundle（base，tsdown 编译）
├─ client/            client module system（client-modules）
├─ sdk/               外部插件包（@lucky-apps/plugin-types、@lucky-apps/client-ui）
├─ tooling/           cli
└─ extensions/        内置插件包（home / reports / trash-bin / 画布与列组件）
src-tauri/            Tauri 壳（窗口、托盘、exe 品牌）
docs-site/            开发文档（VitePress）
scripts/              server / profile 构建与版本同步脚本
resources/            运行时样式 / 插件脚本（服务端按清单下发）
```

App 与 `packages/**` 使用同一版本号（与 DSH 的 lockstep 发布一致）：

```bash
pnpm version:sync 3.2.6
```

会同步根 `package.json`、`apps/*`、`packages/**`、Tauri / Cargo 版本与 README。

<details>
<summary>apps/desktop/src 内部结构</summary>

```
src/
├─ components/
│  ├─ layout/          图标栏 + 导航面板
│  ├─ designer/        自由画布设计器、Element Plus 组件渲染
│  ├─ report/          报表页面、区块、列设置
│  ├─ settings/        设置中心与扩展管理
│  ├─ importexport/    导入/导出/备份
│  ├─ trash/           回收站
│  ├─ TemplateDesigner/ 模板设计器（IDE 布局 + 预览）
│  ├─ cells/           内置列组件（状态/日期/数字）
│  ├─ editors/         Markdown 编辑器
│  ├─ common/          DateRangeField 等通用件（AppDialog 在 @lucky-apps/client-ui）
│  └─ ReportEditor.vue / WelcomePage.vue
├─ composables/        useReports / useTheme / useExtensions
├─ config/             默认报表结构、自由画布布局模型、EP 组件元数据
├─ plugins/            扩展加载、注册中心、对外 API
├─ cordis/             Cordis 根 Context 与启动插件
├─ services/           数据库、模板、配置、导入导出
├─ utils/              日期、防抖、事件、ID、导出渲染
└─ assets/css/         设计令牌与全局样式（亮/暗）
```

</details>

构建时还会生成 `src-tauri/target/profile/`（Cordis profile：`package.json`
`la.profile.bundles` + `node_modules`，不入库）。

## 插件开发

插件是标准 **Vue 3 + TypeScript** 包，放在 `packages/extensions/<name>/`，各自构建到包内
`lib/client.js` 和 `lib/node.js`，包自带 `cordis.patch.yml`。`pnpm profile:build` 会用
`pnpm pack` 打包成 profile 依赖，再由 `pnpm install` 生成
`src-tauri/target/profile/node_modules`。绘制 profile 时按 DSH 语义组合：
空根 → 各 bundle 的 `la.bundle.patch` → profile 的 `cordis.patch.yml`。
画布 / 列 / 功能包同样是 bundle，profile 的 `la.profile.bundles` 列出它们。
弹窗统一使用宿主包 `@lucky-apps/client-ui` 的 `AppDialog`：插件构建时标为 external，
运行时从 `window.__ModuleLoader__` 的 staticModules 取同一份宿主组件，不在插件里复制第二份实现。
Node 服务用真实 Cordis loader 按行里的包名从 profile 的 `node_modules` 解析并挂载；
Tauri 窗口只打开服务地址。浏览器依赖 `vue` / `element-plus` / 图标已经由宿主 Vite
构建进 `dist`，不再重复安装到 profile；profile 只包含 Cordis 插件包（约 150KB），
避免安装/卸载时复制上万个无用文件。
首次启动会复制到 `%APPDATA%/com.lu.lucky-apps/profile`，用户可直接改 profile。
应用升级时按 `la.profile.version` 覆盖随包核心包和系统依赖，同时保留用户
自己安装的插件与 bundle；安装器会先结束旧的托盘进程，避免文件占用和多实例。
浏览器侧 client bundle 构建为 IIFE，Vue / Element Plus / 图标使用宿主 `window` 上的同一份实例。
运行时脚本与样式放入 `resources/js|css/`，由服务端 `/api/boot` 清单下发。

外部插件通过 npm 搜索安装时只展示声明了 `keywords: ["cordis", "lucky-app"]` 的包；
本地目录、GitHub / Git 仓库和直接包名安装仍然可用。

完整开发文档（架构、API、组件、列、模板/画布设计器、常见问题）在 [docs-site](docs-site) 与设置中心 → 帮助文档中。

## 主题

主题模式：`system`（默认）/ `light` / `dark`，保存在 `localStorage` 的 `wr:theme`。
样式统一使用 Element Plus 变量与 `--wr-*` 语义变量；图标栏可快速切换，设置中心可精确选择。

## 数据

- SQLite 数据库 `lucky_apps.db`：由 `reports` 插件的 Node half（`reports-database`）自己提供，
  宿主壳不持有业务数据层；卸载该插件即不再挂载数据库
- 软删除（`deleted_at`）与独立回收站视图
- 报表保存自由画布 `layout`；默认画布保存在 `config` 表
- 左侧导航 → 导入导出（内置插件页），支持全量备份与恢复
