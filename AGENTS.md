# AGENTS

本仓库是 **Lucky Apps**：Tauri 壳 + Cordis Node 服务 + Vue 3 前端，内置能力全部插件化。

## 结构

```text
apps/desktop          Vue 3 + TypeScript 前端（Vite 构建）
apps/server           Cordis Node 服务（TypeScript，esbuild 打包）
packages/core/*       Cordis 核心包（base、client-modules），源码 TS → tsdown 编译
packages/sdk/*        plugin-api（外部组件 API）
packages/tooling/*    CLI
packages/extensions/* 内置插件（Vue SFC + 自带 cordis.patch.yml + Node half）
src-tauri             Tauri 壳（窗口/托盘/exe 品牌、进程管理）
docs-site             VitePress 开发文档
```

## 规则

- 全部 TypeScript；Vue SFC 用 `<script setup lang="ts">`；不新增 `.js` / `.mjs` 源码。
- 插件只允许 import `vue` / `element-plus` / `@element-plus/icons-vue` / `plugin-api` 与包内文件；禁止宿主 `@/` 路径。
- 插件生命周期走 Cordis：`apply(ctx)` 内用 `ctx.navigation` / `ctx.settings` / `ctx.components`；Node half 在 `src/node-extra.ts`（构建成 JS 后随包发布）。
- 数据库等业务数据层归插件所有（`packages/extensions/reports` 的 `reports-database`），宿主不持有。
- 插件 `cordis.patch.yml` 必须入库；构建产物 `lib/` 不入库。
- 提交前跑 `pnpm lint` 与 `pnpm test`；lefthook 已配置 staged 自动修复。
- 不要手工修改 `node_modules`、`dist`、`target`。
