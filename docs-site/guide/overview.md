# 概览

Lucky Apps 支持在不重新构建客户端的前提下扩展样式、插件脚本和 Vue 组件。所有扩展都放在应用资源目录中，保存后即时生效。

宿主本身不绑定业务功能：首页、报表、回收站以及画布 / 列组件都是 `packages/extensions/*` 里的内置插件，和外部插件走同一套 Cordis profile 与生命周期，可以在扩展中心停用。

## 三种扩展方式

| 方式 | 目录 | 生效方式 |
| --- | --- | --- |
| 外部组件 | `extensions` / AppData 插件目录 | 独立包构建后运行时注册 |
| 资源脚本 | `resources/js` | 重新加载应用（周报插件桥接 API） |
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
浏览器 client bundle（IIFE）
```

- 启动：Tauri 启动 Node 服务 → 等待服务返回地址 → WebView 打开该地址。
- 配置：Node 侧组合 profile bundles / patches，用真实 Loader 挂载插件。
- 客户端：浏览器读取 `/api/boot`，加载组件包；插件在 `apply(ctx)` 里通过 Cordis 服务注册能力。

::: warning 运行形态
这里是 Tauri 窗口 + Node 服务；profile 组合和 client modules 按 Cordis 语义实现。
`profile` 是真实 pnpm 项目：插件包先 `pnpm pack` 成 tarball，由 `pnpm install`
安装到 `src-tauri/target/profile/node_modules`。`vue` / `element-plus` 由宿主 Vite
直接构建进前端 `dist`，不重复安装进 profile。
:::

## 装配顺序

1. 安装宿主 Cordis 服务（navigation / settings / components / ui / theme / branding / extensions / db）。
2. 按文件名顺序注入 `resources/css/*.css`。
3. 按文件名顺序加载 `resources/js/*.js`。
4. Node 服务用真实 Cordis Loader 组合 `profile`（首次启动复制到 `%APPDATA%/com.lu.lucky-apps/profile`）：bundle patches → 用户 patch，按包名从 `node_modules` 挂载。
5. 挂载 Vue 应用；插件脚本执行时 API 已就绪。

::: tip 热加载
外部组件包由项目自己构建，宿主在启动时通过 Cordis profile 注册；内置 profile 随应用打包，用户 profile 在 %APPDATA%/com.lu.lucky-apps/profile。
:::

## 能力边界

宿主只提供通用 Cordis 服务；周报业务 API（`reports` / `templates` / `config` / `data`）
由内置 `reports` 插件通过 `ctx.provide('weekReport', ...)` 提供。没有全局 API 对象。
完整字段参考见 [Cordis 服务与周报 API](/guide/api)。
