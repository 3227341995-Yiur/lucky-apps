# AGENTS

本仓库是 **Lucky Apps**：Tauri 壳 + Cordis Node 服务 + Vue 3 前端，内置能力全部插件化。

## 结构

```text
apps/desktop          Vue 3 + TypeScript 前端（Vite 构建）
apps/server           Cordis Node 服务（TypeScript，esbuild 打包）
packages/bundle/*     profile bundle（base）
packages/client/*     client module system（client-modules）
packages/sdk/*        plugin-api（外部组件 API）
packages/sdk/*        @lucky-apps/plugin-api（外部组件 API）
packages/tooling/*    CLI
packages/extensions/* 内置插件（Vue SFC + 自带 cordis.patch.yml + Node half）
src-tauri             Tauri 壳（窗口/托盘/exe 品牌、进程管理）
docs-site             VitePress 开发文档
```

## 规则

- 全部 TypeScript；Vue SFC 用 `<script setup lang="ts">`；不新增 `.js` / `.mjs` 源码。
- 插件是标准的 Vue 3 + Vite + TypeScript 包：想用什么依赖就在自己的 `package.json` 里声明，随便 import，由 Vite 正常打包。
- 插件依赖和版本由插件自己的 `package.json` 声明，构建配置由插件自己决定；宿主不锁定依赖版本。
- `@lucky-apps/plugin-api` 是宿主对外 SDK。唯一禁止的是引用宿主源码内部别名 `@/...`（宿主不是插件的依赖），需要宿主能力请走 `@lucky-apps/plugin-api` / `ctx` 服务。
- 插件生命周期走 Cordis：`apply(ctx)` 内用 `ctx.navigation` / `ctx.settings` / `ctx.components`；Node half 在 `src/node-extra.ts`（构建成 JS 后随包发布）。
- 数据库等业务数据层归插件所有（`packages/extensions/reports` 的 `reports-database`），宿主不持有。
- 插件 `cordis.patch.yml` 必须入库；构建产物 `lib/` 不入库。
- 客户端 bundle 通过 `window.__ModuleLoader__.load({ id, factory })` 注册 CJS factory；`require('vue')` 等由宿主 staticModules 解析，不挂 window 库全局。
- 插件 `package.json` 必须声明 `keywords: ["cordis", "lucky-app"]`；设置中心的 npm 搜索只展示带 `lucky-app` 标签的包。
- 提交前跑 `pnpm lint` 与 `pnpm test`；lefthook 已配置 staged 自动修复。
- 不要手工修改 `node_modules`、`dist`、`target`。
