# 概览

Lucky Apps 支持在不重新构建客户端的前提下扩展样式、插件脚本和 Vue 组件。所有扩展都放在应用资源目录中，保存后即时生效。

## 三种扩展方式

| 方式 | 目录 | 生效方式 |
| --- | --- | --- |
| 外部组件 | `extensions` / AppData 插件目录 | 独立包构建后运行时注册 |
| 插件脚本 | `resources/js` | 重新加载应用 |
| 全局样式 | `resources/css` | 重新加载应用 |

## 运行架构

```text
Tauri WebView（只负责显示）
        │  http://127.0.0.1:34115
        ▼
Cordis Node 服务（server/）
  ├─ 真实 @cordisjs/plugin-loader
  ├─ profile: package.json / cordis.yml / cordis.patch.yml / node_modules
  ├─ SQLite（node:sqlite）+ /api/db RPC
  ├─ /api/boot 下发 client bundle 清单
  └─ 静态托管 dist 与运行时资源
        │  /client/<name>/index.js
        ▼
浏览器 client bundle（IIFE，Vue / Element Plus 用宿主 window 实例）
```

- 启动：Tauri 启动 Node 服务 → 等待服务返回地址 → WebView 打开该地址。
- 配置：Node 侧组合 profile bundles / patches，用真实 Loader 挂载插件。
- 客户端：浏览器读取 `/api/boot`，加载组件包并注册到 `window.weekReport`。

::: warning 与 DSH 的差异
DSH 是纯 Node 进程 + Web 前端；这里是 Tauri 窗口 + Node 服务。
profile 组合和 client modules 是 DSH 语义的最小实现，不是直接复用 DSH app-boot。
`profile` 是真实 pnpm 项目：组件包先 `pnpm pack` 成 tarball，和 `vue` /
`element-plus` 一起由 `pnpm install` 安装到 `src-tauri/target/profile/node_modules`。
:::

## 装配顺序

1. 安装内置能力并暴露 `window.weekReport`。
2. 按文件名顺序注入 `resources/css/*.css`。
3. 按文件名顺序加载 `resources/js/*.js`。
4. Node 服务用真实 Cordis Loader 组合 `profile`（首次启动复制到 `%APPDATA%/com.lu.week-report/profile`）：bundle patches → 用户 patch，按包名从 `node_modules` 挂载。
5. 挂载 Vue 应用；插件脚本执行时 API 已就绪。

::: tip 热加载
外部组件包由项目自己构建，宿主在启动时通过 Cordis profile 注册；内置 profile 随应用打包，用户 profile 在 %APPDATA%/com.lu.week-report/profile。
:::

## API 版本

当前 API 版本为 **2**，入口是 `window.weekReport`。完整字段参考见 [API 参考](/guide/api)。
